import { Orpheus } from '@bbplayer/orpheus'
import type {
	AudioQualityInfo,
	AudioQualityPreference,
} from '@bbplayer/orpheus'
import { useEffect, useRef, useState } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import {
	Dialog,
	RadioButton,
	Surface,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import {
	AUDIO_QUALITY_OPTIONS,
	formatActualAudioQuality,
	formatAudioQualityLabel,
} from '@/constants/audioQuality'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

function applyPreferredAudioQuality(preference: AudioQualityPreference) {
	Orpheus.preferredAudioQuality = preference
}

const AudioQualityModal = () => {
	const close = useModalStore((state) => state.close)
	const colors = useTheme().colors

	const [preference, setPreference] = useState<AudioQualityPreference>(() =>
		Platform.OS === 'android' ? Orpheus.preferredAudioQuality : 'high',
	)

	const [actualQuality, setActualQuality] = useState<AudioQualityInfo | null>(
		null,
	)

	const [switching, setSwitching] = useState(false)
	const switchingRef = useRef(false)

	useEffect(() => {
		let cancelled = false

		void Orpheus.getCurrentAudioQuality()
			.then((info) => {
				if (cancelled) return
				setActualQuality(info)
			})
			.catch((error) => {
				toastAndLogError('读取当前音质失败', error, 'Modal.AudioQuality')
			})

		const subscription = Orpheus.addListener(
			'onAudioQualityChanged',
			(info) => {
				if (cancelled) return
				setActualQuality(info)
			},
		)

		return () => {
			cancelled = true
			subscription.remove()
		}
	}, [])

	const switchQuality = async (next: AudioQualityPreference) => {
		if (switchingRef.current) {
			return
		}

		const label = formatAudioQualityLabel(next)

		if (next === preference) {
			toast.info(`当前已经是 ${label}`)

			return
		}

		const previous = preference

		switchingRef.current = true
		setSwitching(true)
		setPreference(next)

		try {
			applyPreferredAudioQuality(next)

			const result = await Orpheus.reloadCurrentTrackForQualityChange()

			if (result.reloaded) {
				toast.success(`已切换至 ${label}，正在无缝续播`)
			} else if (result.reason === 'downloaded') {
				toast.info(`已设为默认 ${label}`, {
					description: '当前播放的是离线缓存，下一首或重新下载后才生效',
				})
			} else {
				toast.info(`默认音质已设为 ${label}`)
			}
		} catch (error) {
			setPreference(previous)

			try {
				applyPreferredAudioQuality(previous)
			} catch (rollbackError) {
				toastAndLogError(
					'回滚音质偏好失败',
					rollbackError,
					'Modal.AudioQuality',
				)
			}

			toastAndLogError('切换音质失败', error, 'Modal.AudioQuality')
		} finally {
			switchingRef.current = false
			setSwitching(false)
		}
	}

	const handleGroupChange = (value: string) => {
		const option = AUDIO_QUALITY_OPTIONS.find((item) => item.value === value)

		if (!option) {
			return
		}

		void switchQuality(option.value)
	}

	const actual = formatActualAudioQuality(actualQuality)

	return (
		<>
			<Dialog.Title>音质</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
				>
					<Surface
						elevation={0}
						style={[
							styles.actualCard,
							{ backgroundColor: colors.secondaryContainer },
						]}
					>
						<Text
							variant='labelMedium'
							style={{ color: colors.onSecondaryContainer }}
						>
							当前实际播放音质
						</Text>
						<Text
							variant='titleMedium'
							style={[
								styles.actualTitle,
								{ color: colors.onSecondaryContainer },
							]}
						>
							{actual ? actual.title : '暂无正在播放的曲目'}
						</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSecondaryContainer }}
						>
							{actual
								? actual.subtitle
								: '选好档位会存为默认音质，下一首播放时生效。'}
						</Text>
					</Surface>

					<RadioButton.Group
						value={preference}
						onValueChange={handleGroupChange}
					>
						<View style={styles.optionList}>
							{AUDIO_QUALITY_OPTIONS.map((option) => {
								const selected = option.value === preference

								return (
									<TouchableRipple
										key={option.value}
										testID={`audio-quality-option-${option.value}`}
										borderless
										disabled={switching}
										onPress={() => {
											void switchQuality(option.value)
										}}
										style={[
											styles.optionRow,
											selected && {
												backgroundColor: colors.surfaceVariant,
											},
										]}
									>
										<View style={styles.optionContent}>
											{switching && selected ? (
												<ActivityIndicator
													size='small'
													style={styles.optionIndicator}
												/>
											) : (
												<RadioButton
													value={option.value}
													status={selected ? 'checked' : 'unchecked'}
													disabled={switching}
												/>
											)}
											<View style={styles.optionText}>
												<View style={styles.optionHeader}>
													<Text variant='titleSmall'>{option.label}</Text>
													<Text
														variant='labelSmall'
														style={[
															styles.optionBadge,
															{ color: colors.primary },
														]}
													>
														{option.badge}
													</Text>
												</View>
												<Text
													variant='bodySmall'
													style={{ color: colors.onSurfaceVariant }}
												>
													{option.description}
												</Text>
											</View>
										</View>
									</TouchableRipple>
								)
							})}
						</View>
					</RadioButton.Group>
				</ScrollView>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					disabled={switching}
					onPress={() => close('AudioQuality')}
				>
					关闭
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		flexShrink: 1,
	},
	scroll: {
		flexShrink: 1,
	},
	scrollContent: {
		paddingBottom: 8,
	},
	actualCard: {
		borderRadius: 16,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginBottom: 12,
		gap: 2,
	},
	actualTitle: {
		fontWeight: 'bold',
	},
	optionList: {
		gap: 2,
	},
	optionRow: {
		borderRadius: 16,
	},
	optionContent: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingRight: 12,
		paddingVertical: 4,
	},
	optionIndicator: {
		marginHorizontal: 14,
	},
	optionText: {
		flexShrink: 1,
		flexGrow: 1,
		gap: 2,
	},
	optionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	optionBadge: {
		fontWeight: 'bold',
	},
})

export default AudioQualityModal

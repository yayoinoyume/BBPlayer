import {
	EQ_BAND_COUNT,
	EQ_MAX_GAIN_DB,
	EQ_MIN_GAIN_DB,
	Orpheus,
	type EqualizerPreset,
	type EqualizerSettings,
} from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import {
	ActivityIndicator,
	Appbar,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { useSettingsSplit } from '@/components/layout/SettingsNavigation'
import EqBandSliders from '@/features/equalizer/components/EqBandSliders'
import EqPresetBar from '@/features/equalizer/components/EqPresetBar'
import EqResponseCurve from '@/features/equalizer/components/EqResponseCurve'
import {
	deleteCustomPreset,
	parseCustomPresetsJson,
	renameCustomPreset,
	serializeCustomPresets,
	upsertCustomPreset,
} from '@/features/equalizer/utils/customPresets'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

const FLAT_GAINS = Array.from({ length: EQ_BAND_COUNT }, () => 0)

const INITIAL_SETTINGS: EqualizerSettings = {
	enabled: false,
	preampDb: 0,
	limiterEnabled: true,
	gainsDb: FLAT_GAINS,
	activePresetId: 'flat',
}

const PREAMP_TRACK_HEIGHT = 40

const PREAMP_TRACK_THICKNESS = 4

const PREAMP_THUMB_SIZE = 18

const PREAMP_STEP_DB = 0.5

const PREAMP_THROTTLE_MS = 50

const PREAMP_RANGE_DB = EQ_MAX_GAIN_DB - EQ_MIN_GAIN_DB

function quantizePreampDb(preampDb: number): number {
	const stepped = Math.round(preampDb / PREAMP_STEP_DB) * PREAMP_STEP_DB

	return Math.min(EQ_MAX_GAIN_DB, Math.max(EQ_MIN_GAIN_DB, stepped))
}

function formatPreampDb(preampDb: number): string {
	const magnitude = Math.abs(preampDb).toFixed(1)

	if (preampDb > 0) return `+${magnitude}`

	if (preampDb < 0) return `-${magnitude}`

	return magnitude
}

interface PreampControlProps {
	enabled: boolean
	value: number
	onChange: (preampDb: number) => void
	onCommit: (preampDb: number) => void
}

function PreampControl({
	enabled,
	value,
	onChange,
	onCommit,
}: PreampControlProps) {
	const { colors } = useTheme()

	const [displayValue, setDisplayValue] = useState(value)

	const [trackWidth, setTrackWidth] = useState(0)

	const draggingRef = useRef(false)

	const lastEmitRef = useRef(0)

	useEffect(() => {
		if (draggingRef.current) return

		setDisplayValue(value)
	}, [value])

	const valueFromX = useCallback(
		(x: number) => {
			if (trackWidth <= 0) return value

			const ratio = Math.min(Math.max(x / trackWidth, 0), 1)

			return quantizePreampDb(EQ_MIN_GAIN_DB + ratio * PREAMP_RANGE_DB)
		},
		[trackWidth, value],
	)

	const emitChange = useCallback(
		(nextValue: number) => {
			setDisplayValue(nextValue)

			const now = Date.now()

			if (now - lastEmitRef.current < PREAMP_THROTTLE_MS) return

			lastEmitRef.current = now

			onChange(nextValue)
		},
		[onChange],
	)

	const panGesture = usePanGesture({
		runOnJS: true,
		minDistance: 0,
		shouldCancelWhenOutside: false,
		onBegin: (event) => {
			draggingRef.current = true
			lastEmitRef.current = 0

			const nextValue = valueFromX(event.x)

			setDisplayValue(nextValue)

			onChange(nextValue)
		},
		onUpdate: (event) => {
			emitChange(valueFromX(event.x))
		},
		onFinalize: (event) => {
			draggingRef.current = false

			const nextValue = valueFromX(event.x)

			setDisplayValue(nextValue)

			onCommit(nextValue)
		},
	})

	const handleReset = useCallback(() => {
		setDisplayValue(0)
		onChange(0)
		onCommit(0)
	}, [onChange, onCommit])

	const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
		const nextWidth = event.nativeEvent.layout.width

		setTrackWidth((previous) => (previous === nextWidth ? previous : nextWidth))
	}, [])

	const activeColor = enabled ? colors.primary : colors.outline

	const centerX = trackWidth / 2

	const thumbCenterX =
		trackWidth > 0
			? ((displayValue - EQ_MIN_GAIN_DB) / PREAMP_RANGE_DB) * trackWidth
			: centerX

	return (
		<View
			style={styles.preamp}
			testID='eq-preamp-control'
		>
			<View style={styles.preampHeader}>
				<Text variant='bodyMedium'>前置增益（Preamp）</Text>
				<View style={styles.preampValue}>
					<Text
						variant='labelLarge'
						style={[styles.preampValueText, { color: colors.onSurface }]}
					>
						{formatPreampDb(displayValue)} dB
					</Text>
					<IconButton
						icon='restore'
						size={18}
						testID='eq-preamp-reset'
						accessibilityLabel='前置增益归零'
						onPress={handleReset}
					/>
				</View>
			</View>
			<GestureDetector gesture={panGesture}>
				<View
					accessible
					accessibilityRole='adjustable'
					accessibilityLabel='前置增益'
					accessibilityValue={{ text: `${formatPreampDb(displayValue)} 分贝` }}
					style={styles.preampTrackArea}
					onLayout={handleTrackLayout}
				>
					<View
						style={[
							styles.preampTrack,
							{ backgroundColor: colors.outlineVariant },
						]}
					/>
					<View
						style={[
							styles.preampFill,
							{
								left: Math.min(thumbCenterX, centerX),
								width: Math.abs(thumbCenterX - centerX),
								backgroundColor: activeColor,
							},
						]}
					/>
					<View
						style={[
							styles.preampThumb,
							{
								left: thumbCenterX - PREAMP_THUMB_SIZE / 2,
								backgroundColor: activeColor,
							},
						]}
					/>
				</View>
			</GestureDetector>
			<Text
				variant='bodySmall'
				style={{ color: colors.onSurfaceVariant }}
			>
				提升整体电平会让频段提升更容易削波，建议同时开启防破音保护。
			</Text>
		</View>
	)
}

export default function EqualizerSettingsPage() {
	const router = useRouter()
	const split = useSettingsSplit()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const isAndroid = Platform.OS === 'android'

	const [settings, setSettings] = useState<EqualizerSettings>(INITIAL_SETTINGS)

	const [customPresets, setCustomPresets] = useState<EqualizerPreset[]>([])

	const [loading, setLoading] = useState(isAndroid)

	const [scrollEnabled, setScrollEnabled] = useState(true)

	const draggingRef = useRef(false)

	const bandErrorRef = useRef(false)

	useEffect(() => {
		if (!isAndroid) return

		let cancelled = false

		void (async () => {
			try {
				const [nativeSettings, customPresetsJson] = await Promise.all([
					Orpheus.getEqualizerSettings(),
					Orpheus.getCustomEqualizerPresetsJson(),
				])

				if (cancelled) return

				setSettings(nativeSettings)

				setCustomPresets(parseCustomPresetsJson(customPresetsJson))
			} catch (error) {
				if (!cancelled) {
					toastAndLogError('读取均衡器设置失败', error, 'Equalizer')
				}
			} finally {
				if (!cancelled) setLoading(false)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [isAndroid])

	useEffect(() => {
		if (!isAndroid) return

		const subscription = Orpheus.addListener('onEqualizerChanged', (next) => {
			if (draggingRef.current) return

			setSettings(next)
		})

		return () => {
			subscription.remove()
		}
	}, [isAndroid])

	const runEqualizerAction = useCallback(
		async (
			action: () => Promise<EqualizerSettings>,
			failureMessage: string,
		) => {
			try {
				const next = await action()

				setSettings(next)
			} catch (error) {
				toastAndLogError(failureMessage, error, 'Equalizer')
			}
		},
		[],
	)

	const persistCustomPresets = useCallback(
		async (nextPresets: EqualizerPreset[]) => {
			setCustomPresets(nextPresets)

			if (!isAndroid) return

			try {
				await Orpheus.setCustomEqualizerPresetsJson(
					serializeCustomPresets(nextPresets),
				)
			} catch (error) {
				toastAndLogError('保存自定义预设失败', error, 'Equalizer')
			}
		},
		[isAndroid],
	)

	const applyPreset = useCallback(
		(preset: EqualizerPreset, currentSettings: EqualizerSettings) => {
			setSettings({
				...currentSettings,
				activePresetId: preset.id,
				gainsDb: [...preset.gainsDb],
				preampDb: preset.preampDb,
			})

			if (!isAndroid) return

			void runEqualizerAction(
				() =>
					Orpheus.setEqualizerSettings(
						currentSettings.enabled,
						preset.preampDb,
						currentSettings.limiterEnabled,
						preset.gainsDb,
						preset.id,
					),
				'应用均衡器预设失败',
			)
		},
		[isAndroid, runEqualizerAction],
	)

	const handleToggleEnabled = useCallback(() => {
		if (!isAndroid) return

		void runEqualizerAction(
			() =>
				Orpheus.setEqualizerSettings(
					!settings.enabled,
					settings.preampDb,
					settings.limiterEnabled,
					settings.gainsDb,
					settings.activePresetId,
				),
			'切换均衡器失败',
		)
	}, [isAndroid, runEqualizerAction, settings])

	const handleToggleLimiter = useCallback(() => {
		if (!isAndroid) return

		void runEqualizerAction(
			() => Orpheus.setEqualizerLimiterEnabled(!settings.limiterEnabled),
			'切换防破音保护失败',
		)
	}, [isAndroid, runEqualizerAction, settings.limiterEnabled])

	const handleReset = useCallback(() => {
		if (!isAndroid) return

		void (async () => {
			try {
				const next = await Orpheus.resetEqualizer()

				setSettings(next)

				toast.success('已恢复平坦响应')
			} catch (error) {
				toastAndLogError('重置均衡器失败', error, 'Equalizer')
			}
		})()
	}, [isAndroid])

	const handleSelectPreset = useCallback(
		(preset: EqualizerPreset) => {
			applyPreset(preset, settings)
		},
		[applyPreset, settings],
	)

	const updateBandGain = useCallback((bandIndex: number, gainDb: number) => {
		setSettings((previous) => {
			const gainsDb = [...previous.gainsDb]

			gainsDb[bandIndex] = gainDb

			return { ...previous, gainsDb, activePresetId: null }
		})
	}, [])

	const handleBandChange = useCallback(
		(bandIndex: number, gainDb: number) => {
			updateBandGain(bandIndex, gainDb)

			if (!isAndroid || bandErrorRef.current) return

			void (async () => {
				try {
					await Orpheus.setEqualizerBandGain(bandIndex, gainDb)
				} catch (error) {
					bandErrorRef.current = true

					toastAndLogError('调整均衡器失败', error, 'Equalizer')
				}
			})()
		},
		[isAndroid, updateBandGain],
	)

	const handleBandCommit = useCallback(
		(bandIndex: number, gainDb: number) => {
			bandErrorRef.current = false

			updateBandGain(bandIndex, gainDb)

			if (!isAndroid) return

			void runEqualizerAction(
				() => Orpheus.setEqualizerBandGain(bandIndex, gainDb),
				'保存均衡器设置失败',
			)
		},
		[isAndroid, runEqualizerAction, updateBandGain],
	)

	const handlePreampChange = useCallback(
		(preampDb: number) => {
			setSettings((previous) => ({
				...previous,
				preampDb,
				activePresetId: null,
			}))

			if (!isAndroid) return

			void (async () => {
				try {
					await Orpheus.setEqualizerPreamp(preampDb)
				} catch (error) {
					toastAndLogError('调整前置增益失败', error, 'Equalizer')
				}
			})()
		},
		[isAndroid],
	)

	const handlePreampCommit = useCallback(
		(preampDb: number) => {
			if (!isAndroid) return

			void runEqualizerAction(
				() => Orpheus.setEqualizerPreamp(preampDb),
				'保存前置增益失败',
			)
		},
		[isAndroid, runEqualizerAction],
	)

	const handleDragActiveChange = useCallback((active: boolean) => {
		draggingRef.current = active

		setScrollEnabled(!active)
	}, [])

	const handleSavePresetAs = useCallback(
		(name: string) => {
			const { presets, preset } = upsertCustomPreset(customPresets, {
				name,
				gainsDb: settings.gainsDb,
				preampDb: settings.preampDb,
			})

			if (!preset) {
				toast.error('预设名称不能为空')

				return
			}

			void persistCustomPresets(presets)

			toast.success(`已保存「${preset.name}」`)

			applyPreset(preset, settings)
		},
		[applyPreset, customPresets, persistCustomPresets, settings],
	)

	const handleOverwritePreset = useCallback(
		(id: string) => {
			const target = customPresets.find((preset) => preset.id === id)

			if (!target) return

			const { presets, preset } = upsertCustomPreset(customPresets, {
				id,
				name: target.name,
				gainsDb: settings.gainsDb,
				preampDb: settings.preampDb,
			})

			if (!preset) return

			void persistCustomPresets(presets)

			toast.success(`已覆盖「${preset.name}」`)

			applyPreset(preset, settings)
		},
		[applyPreset, customPresets, persistCustomPresets, settings],
	)

	const handleRenamePreset = useCallback(
		(id: string, name: string) => {
			if (!name.trim()) {
				toast.error('预设名称不能为空')

				return
			}

			void persistCustomPresets(renameCustomPreset(customPresets, id, name))
		},
		[customPresets, persistCustomPresets],
	)

	const handleDeletePreset = useCallback(
		(id: string) => {
			void persistCustomPresets(deleteCustomPreset(customPresets, id))

			if (settings.activePresetId !== id) return

			setSettings((previous) => ({ ...previous, activePresetId: null }))

			if (!isAndroid) return

			void runEqualizerAction(
				() =>
					Orpheus.setEqualizerSettings(
						settings.enabled,
						settings.preampDb,
						settings.limiterEnabled,
						settings.gainsDb,
						null,
					),
				'更新当前预设失败',
			)
		},
		[
			customPresets,
			isAndroid,
			persistCustomPresets,
			runEqualizerAction,
			settings,
		],
	)

	const offloadEnabled = isAndroid && !Orpheus.testForcePcm

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				{!split && <Appbar.BackAction onPress={() => router.back()} />}
				<Appbar.Content title='均衡器' />
				<Appbar.Action
					icon='restart'
					testID='eq-reset-button'
					accessibilityLabel='重置为平坦响应'
					disabled={!isAndroid || loading}
					onPress={handleReset}
				/>
			</Appbar.Header>
			{!isAndroid ? (
				<View style={styles.placeholder}>
					<Text
						variant='bodyLarge'
						style={{ textAlign: 'center' }}
					>
						均衡器目前仅支持 Android 设备。
					</Text>
				</View>
			) : loading ? (
				<View style={styles.placeholder}>
					<ActivityIndicator />
				</View>
			) : (
				<ScrollView
					style={styles.scrollView}
					scrollEnabled={scrollEnabled}
					contentContainerStyle={[
						styles.scrollContent,
						{ paddingBottom: insets.bottom + (haveTrack ? 90 : 24) },
					]}
				>
					<Surface
						mode='flat'
						style={[styles.card, { backgroundColor: colors.surfaceVariant }]}
					>
						<View style={styles.row}>
							<View style={styles.rowText}>
								<Text variant='bodyLarge'>启用均衡器</Text>
								<Text
									variant='bodySmall'
									style={{ color: colors.onSurfaceVariant }}
								>
									关闭后播放链路完全绕过均衡器，与原始音频一致。
								</Text>
							</View>
							<UniversalSwitch
								testID='eq-master-switch'
								value={settings.enabled}
								onValueChange={handleToggleEnabled}
							/>
						</View>
						{settings.enabled && offloadEnabled && (
							<Text
								variant='bodySmall'
								style={[styles.hint, { color: colors.onSurfaceVariant }]}
							>
								省电直通（offload）当前处于开启状态，启用均衡器后会自动改用 PCM
								播放，耗电可能略有增加。
							</Text>
						)}
					</Surface>
					<Surface
						mode='flat'
						style={[styles.card, { backgroundColor: colors.surfaceVariant }]}
					>
						<EqResponseCurve
							enabled={settings.enabled}
							gainsDb={settings.gainsDb}
							preampDb={settings.preampDb}
						/>
					</Surface>
					<SettingsSectionTitle title='预设' />
					<EqPresetBar
						activePresetId={settings.activePresetId}
						customPresets={customPresets}
						enabled={settings.enabled}
						onDelete={handleDeletePreset}
						onOverwrite={handleOverwritePreset}
						onRename={handleRenamePreset}
						onSaveAs={handleSavePresetAs}
						onSelect={handleSelectPreset}
					/>
					<SettingsSectionTitle title='频段' />
					<EqBandSliders
						gainsDb={settings.gainsDb}
						enabled={settings.enabled}
						onBandChange={handleBandChange}
						onBandCommit={handleBandCommit}
						onDragActiveChange={handleDragActiveChange}
					/>
					<SettingsSectionTitle title='高级控制' />
					<Surface
						mode='flat'
						style={[styles.card, { backgroundColor: colors.surfaceVariant }]}
					>
						<PreampControl
							enabled={settings.enabled}
							value={settings.preampDb}
							onChange={handlePreampChange}
							onCommit={handlePreampCommit}
						/>
						<View
							style={[
								styles.divider,
								{ backgroundColor: colors.outlineVariant },
							]}
						/>
						<View style={styles.row}>
							<View style={styles.rowText}>
								<Text variant='bodyLarge'>防破音保护（软限幅）</Text>
								<Text
									variant='bodySmall'
									style={{ color: colors.onSurfaceVariant }}
								>
									抑制提升带来的削波失真，可能略微压缩动态。
								</Text>
							</View>
							<UniversalSwitch
								testID='eq-limiter-switch'
								value={settings.limiterEnabled}
								onValueChange={handleToggleLimiter}
							/>
						</View>
					</Surface>
				</ScrollView>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		gap: 12,
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	placeholder: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: 32,
	},
	card: {
		borderRadius: 16,
		padding: 16,
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	rowText: {
		flex: 1,
		marginEnd: 12,
	},
	hint: {
		marginTop: 12,
		opacity: 0.9,
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		marginVertical: 12,
	},
	preamp: {
		gap: 4,
	},
	preampHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	preampValue: {
		alignItems: 'center',
		flexDirection: 'row',
	},
	preampValueText: {
		fontVariant: ['tabular-nums'],
	},
	preampTrackArea: {
		height: PREAMP_TRACK_HEIGHT,
		justifyContent: 'center',
	},
	preampTrack: {
		borderRadius: PREAMP_TRACK_THICKNESS / 2,
		height: PREAMP_TRACK_THICKNESS,
		position: 'absolute',
		width: '100%',
	},
	preampFill: {
		borderRadius: PREAMP_TRACK_THICKNESS / 2,
		height: PREAMP_TRACK_THICKNESS,
		position: 'absolute',
	},
	preampThumb: {
		borderRadius: PREAMP_THUMB_SIZE / 2,
		elevation: 2,
		height: PREAMP_THUMB_SIZE,
		position: 'absolute',
		width: PREAMP_THUMB_SIZE,
	},
})

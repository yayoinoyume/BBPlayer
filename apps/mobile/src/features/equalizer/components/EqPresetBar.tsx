import { BUILTIN_EQ_PRESETS, type EqualizerPreset } from '@bbplayer/orpheus'
import { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Chip,
	Dialog,
	Portal,
	Text,
	TextInput,
	useTheme,
} from 'react-native-paper'

import Button from '@/components/common/Button'
import { useDialogHorizontalMargin } from '@/hooks/ui/useResponsiveLayout'

const MAX_PRESET_NAME_LENGTH = 24

type NameDialogMode = 'save' | 'rename'

export interface EqPresetBarProps {
	activePresetId: string | null
	customPresets: readonly EqualizerPreset[]
	enabled: boolean
	onDelete: (id: string) => void
	onOverwrite: (id: string) => void
	onRename: (id: string, name: string) => void
	onSaveAs: (name: string) => void
	onSelect: (preset: EqualizerPreset) => void
}

export default function EqPresetBar({
	activePresetId,
	customPresets,
	enabled,
	onDelete,
	onOverwrite,
	onRename,
	onSaveAs,
	onSelect,
}: EqPresetBarProps) {
	const { colors } = useTheme()

	const dialogMargin = useDialogHorizontalMargin()

	const [nameDialogMode, setNameDialogMode] = useState<NameDialogMode | null>(
		null,
	)

	const [nameDraft, setNameDraft] = useState('')

	const [renameTargetId, setRenameTargetId] = useState<string | null>(null)

	const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

	const activeCustomPreset = useMemo(
		() => customPresets.find((preset) => preset.id === activePresetId) ?? null,
		[activePresetId, customPresets],
	)

	const deleteTarget = useMemo(
		() => customPresets.find((preset) => preset.id === deleteTargetId) ?? null,
		[deleteTargetId, customPresets],
	)

	const openSaveDialog = useCallback(() => {
		setNameDraft(`自定义${customPresets.length + 1}`)
		setRenameTargetId(null)
		setNameDialogMode('save')
	}, [customPresets.length])

	const openRenameDialog = useCallback((preset: EqualizerPreset) => {
		setNameDraft(preset.name)
		setRenameTargetId(preset.id)
		setNameDialogMode('rename')
	}, [])

	const closeNameDialog = useCallback(() => {
		setNameDialogMode(null)
		setRenameTargetId(null)
	}, [])

	const handleConfirmName = useCallback(() => {
		const name = nameDraft.trim()

		if (!name) return

		if (nameDialogMode === 'rename') {
			if (renameTargetId) onRename(renameTargetId, name)
		} else if (nameDialogMode === 'save') {
			onSaveAs(name)
		}

		closeNameDialog()
	}, [
		closeNameDialog,
		nameDialogMode,
		nameDraft,
		onRename,
		onSaveAs,
		renameTargetId,
	])

	const handleConfirmDelete = useCallback(() => {
		if (!deleteTargetId) return

		onDelete(deleteTargetId)
		setDeleteTargetId(null)
	}, [deleteTargetId, onDelete])

	return (
		<View style={styles.container}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.chips}
			>
				{BUILTIN_EQ_PRESETS.map((preset) => (
					<Chip
						key={preset.id}
						compact
						selected={preset.id === activePresetId}
						showSelectedCheck
						testID={`eq-preset-${preset.id}`}
						onPress={() => onSelect(preset)}
					>
						{preset.name}
					</Chip>
				))}
				{customPresets.map((preset) => (
					<Chip
						key={preset.id}
						compact
						icon='tune-variant'
						selected={preset.id === activePresetId}
						showSelectedCheck={false}
						testID={`eq-preset-${preset.id}`}
						onPress={() => onSelect(preset)}
						onLongPress={() => openRenameDialog(preset)}
					>
						{preset.name}
					</Chip>
				))}
				<Chip
					icon='plus'
					compact
					testID='eq-save-preset-button'
					onPress={openSaveDialog}
				>
					另存为
				</Chip>
			</ScrollView>
			{activeCustomPreset ? (
				<View style={styles.actions}>
					<Text
						variant='labelMedium'
						style={[styles.actionsTitle, { color: colors.onSurfaceVariant }]}
					>
						自定义预设「{activeCustomPreset.name}」
					</Text>
					<Button
						mode='text'
						compact
						testID='eq-overwrite-preset-button'
						onPress={() => onOverwrite(activeCustomPreset.id)}
					>
						覆盖
					</Button>
					<Button
						mode='text'
						compact
						testID='eq-rename-preset-button'
						onPress={() => openRenameDialog(activeCustomPreset)}
					>
						重命名
					</Button>
					<Button
						mode='text'
						compact
						testID='eq-delete-preset-button'
						onPress={() => setDeleteTargetId(activeCustomPreset.id)}
					>
						删除
					</Button>
				</View>
			) : null}
			{!enabled ? (
				<Text
					variant='bodySmall'
					style={[styles.hint, { color: colors.onSurfaceVariant }]}
				>
					均衡器已关闭，选择预设后开启即可生效。
				</Text>
			) : null}
			<Portal>
				<Dialog
					visible={nameDialogMode !== null}
					onDismiss={closeNameDialog}
					style={{ marginHorizontal: dialogMargin }}
				>
					<Dialog.Title>
						{nameDialogMode === 'rename' ? '重命名预设' : '另存为自定义预设'}
					</Dialog.Title>
					<Dialog.Content>
						<TextInput
							mode='outlined'
							label='预设名称'
							value={nameDraft}
							maxLength={MAX_PRESET_NAME_LENGTH}
							autoFocus
							testID='eq-preset-name-input'
							onChangeText={setNameDraft}
						/>
					</Dialog.Content>
					<Dialog.Actions>
						<Button
							mode='text'
							onPress={closeNameDialog}
						>
							取消
						</Button>
						<Button
							mode='text'
							disabled={!nameDraft.trim()}
							testID='eq-preset-name-confirm'
							onPress={handleConfirmName}
						>
							保存
						</Button>
					</Dialog.Actions>
				</Dialog>
				<Dialog
					visible={deleteTarget !== null}
					onDismiss={() => setDeleteTargetId(null)}
					style={{ marginHorizontal: dialogMargin }}
				>
					<Dialog.Title>删除预设</Dialog.Title>
					<Dialog.Content>
						<Text variant='bodyMedium'>
							确定删除「{deleteTarget?.name ?? ''}」吗？删除后无法恢复。
						</Text>
					</Dialog.Content>
					<Dialog.Actions>
						<Button
							mode='text'
							onPress={() => setDeleteTargetId(null)}
						>
							取消
						</Button>
						<Button
							mode='text'
							testID='eq-preset-delete-confirm'
							onPress={handleConfirmDelete}
						>
							删除
						</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		gap: 8,
	},
	chips: {
		gap: 8,
		paddingVertical: 2,
	},
	actions: {
		alignItems: 'center',
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 4,
	},
	actionsTitle: {
		marginEnd: 4,
	},
	hint: {
		opacity: 0.9,
	},
})

import {
	EQ_BAND_LABELS,
	EQ_MAX_GAIN_DB,
	EQ_MIN_GAIN_DB,
} from '@bbplayer/orpheus'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AccessibilityActionEvent } from 'react-native'
import { ScrollView, StyleSheet, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { Text, useTheme } from 'react-native-paper'

import * as Haptics from '@/utils/haptics'

const TRACK_HEIGHT = 176

const TRACK_WIDTH = 4

const TRACK_HIT_WIDTH = 30

const THUMB_SIZE = 18

const COLUMN_MIN_WIDTH = 32

const GAIN_RANGE_DB = EQ_MAX_GAIN_DB - EQ_MIN_GAIN_DB

const GAIN_STEP_DB = 0.5

const CHANGE_THROTTLE_MS = 50

const DOUBLE_TAP_INTERVAL_MS = 320

const ACCESSIBILITY_STEP_DB = 1

export interface EqBandSlidersProps {
	gainsDb: readonly number[]
	enabled: boolean
	onBandChange: (index: number, gainDb: number) => void
	onBandCommit: (index: number, gainDb: number) => void
	onDragActiveChange: (active: boolean) => void
}

function quantizeGainDb(gainDb: number): number {
	const stepped = Math.round(gainDb / GAIN_STEP_DB) * GAIN_STEP_DB

	return Math.min(EQ_MAX_GAIN_DB, Math.max(EQ_MIN_GAIN_DB, stepped))
}

function gainToY(gainDb: number): number {
	return ((EQ_MAX_GAIN_DB - gainDb) / GAIN_RANGE_DB) * TRACK_HEIGHT
}

function yToGain(y: number): number {
	const clampedY = Math.min(Math.max(y, 0), TRACK_HEIGHT)

	return quantizeGainDb(
		EQ_MAX_GAIN_DB - (clampedY / TRACK_HEIGHT) * GAIN_RANGE_DB,
	)
}

function formatGainDb(gainDb: number): string {
	const magnitude = Math.abs(gainDb).toFixed(1)

	if (gainDb > 0) return `+${magnitude}`

	if (gainDb < 0) return `-${magnitude}`

	return magnitude
}

interface BandSliderProps {
	index: number
	label: string
	gainDb: number
	enabled: boolean
	onChange: (index: number, gainDb: number) => void
	onCommit: (index: number, gainDb: number) => void
	onDragActiveChange: (index: number, active: boolean) => void
}

function BandSlider({
	index,
	label,
	gainDb,
	enabled,
	onChange,
	onCommit,
	onDragActiveChange,
}: BandSliderProps) {
	const { colors } = useTheme()

	const [displayGainDb, setDisplayGainDb] = useState(gainDb)

	const draggingRef = useRef(false)

	const lastEmitRef = useRef(0)

	const lastTapRef = useRef(0)

	const movedRef = useRef(false)

	useEffect(() => {
		if (draggingRef.current) return

		setDisplayGainDb(gainDb)
	}, [gainDb])

	const emitChange = useCallback(
		(nextGainDb: number) => {
			setDisplayGainDb(nextGainDb)

			const now = Date.now()

			if (now - lastEmitRef.current < CHANGE_THROTTLE_MS) return

			lastEmitRef.current = now

			onChange(index, nextGainDb)
		},
		[index, onChange],
	)

	const panGesture = usePanGesture({
		runOnJS: true,
		minDistance: 0,
		shouldCancelWhenOutside: false,
		onBegin: (event) => {
			draggingRef.current = true
			movedRef.current = false
			lastEmitRef.current = 0
			onDragActiveChange(index, true)

			const nextGainDb = yToGain(event.y)

			setDisplayGainDb(nextGainDb)

			onChange(index, nextGainDb)
		},
		onUpdate: (event) => {
			movedRef.current = true

			emitChange(yToGain(event.y))
		},
		onFinalize: (event) => {
			draggingRef.current = false
			onDragActiveChange(index, false)

			const finalGainDb = yToGain(event.y)

			const now = Date.now()

			const isTap = !movedRef.current

			if (isTap && now - lastTapRef.current <= DOUBLE_TAP_INTERVAL_MS) {
				lastTapRef.current = 0

				setDisplayGainDb(0)

				void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)

				onChange(index, 0)

				onCommit(index, 0)

				return
			}

			lastTapRef.current = isTap ? now : 0

			setDisplayGainDb(finalGainDb)

			onCommit(index, finalGainDb)
		},
	})

	const handleAccessibilityAction = useCallback(
		(event: AccessibilityActionEvent) => {
			const delta =
				event.nativeEvent.actionName === 'increment'
					? ACCESSIBILITY_STEP_DB
					: -ACCESSIBILITY_STEP_DB

			const nextGainDb = quantizeGainDb(displayGainDb + delta)

			setDisplayGainDb(nextGainDb)

			onChange(index, nextGainDb)

			onCommit(index, nextGainDb)
		},
		[displayGainDb, index, onChange, onCommit],
	)

	const activeColor = enabled ? colors.primary : colors.outline

	const centerY = TRACK_HEIGHT / 2

	const valueY = gainToY(displayGainDb)

	return (
		<View style={styles.column}>
			<Text
				variant='labelSmall'
				style={[
					styles.valueLabel,
					{ color: enabled ? colors.onSurface : colors.onSurfaceVariant },
				]}
			>
				{formatGainDb(displayGainDb)}
			</Text>
			<GestureDetector gesture={panGesture}>
				<View
					accessible
					accessibilityRole='adjustable'
					accessibilityLabel={`${label} 赫兹频段`}
					accessibilityValue={{ text: `${formatGainDb(displayGainDb)} 分贝` }}
					accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
					onAccessibilityAction={handleAccessibilityAction}
					style={styles.trackHitArea}
				>
					<View
						style={[styles.track, { backgroundColor: colors.surfaceVariant }]}
					/>
					<View
						style={[
							styles.fill,
							{
								top: Math.min(valueY, centerY),
								height: Math.abs(centerY - valueY),
								backgroundColor: activeColor,
							},
						]}
					/>
					<View
						style={[
							styles.thumb,
							{ top: valueY - THUMB_SIZE / 2, backgroundColor: activeColor },
						]}
					/>
				</View>
			</GestureDetector>
			<Text
				variant='labelSmall'
				style={[styles.frequencyLabel, { color: colors.onSurfaceVariant }]}
			>
				{label}
			</Text>
		</View>
	)
}

export default function EqBandSliders({
	gainsDb,
	enabled,
	onBandChange,
	onBandCommit,
	onDragActiveChange,
}: EqBandSlidersProps) {
	const activeDragsRef = useRef(new Set<number>())

	const [isAnyBandDragging, setIsAnyBandDragging] = useState(false)

	const handleDragActiveChange = useCallback(
		(index: number, active: boolean) => {
			const activeDrags = activeDragsRef.current

			const wasDragging = activeDrags.size > 0

			if (active) {
				activeDrags.add(index)
			} else {
				activeDrags.delete(index)
			}

			const isDragging = activeDrags.size > 0

			if (wasDragging === isDragging) return

			setIsAnyBandDragging(isDragging)

			onDragActiveChange(isDragging)
		},
		[onDragActiveChange],
	)

	useEffect(() => {
		const activeDrags = activeDragsRef.current

		return () => {
			activeDrags.clear()
		}
	}, [])

	return (
		<ScrollView
			horizontal
			scrollEnabled={!isAnyBandDragging}
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.content}
		>
			{EQ_BAND_LABELS.map((label, index) => (
				<BandSlider
					key={label}
					index={index}
					label={label}
					gainDb={gainsDb[index] ?? 0}
					enabled={enabled}
					onChange={onBandChange}
					onCommit={onBandCommit}
					onDragActiveChange={handleDragActiveChange}
				/>
			))}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		flexGrow: 1,
		gap: 2,
		paddingVertical: 4,
	},
	column: {
		alignItems: 'center',
		flexBasis: 0,
		flexGrow: 1,
		gap: 6,
		minWidth: COLUMN_MIN_WIDTH,
	},
	valueLabel: {
		fontVariant: ['tabular-nums'],
	},
	trackHitArea: {
		alignItems: 'center',
		height: TRACK_HEIGHT,
		width: TRACK_HIT_WIDTH,
	},
	track: {
		borderRadius: TRACK_WIDTH / 2,
		height: TRACK_HEIGHT,
		position: 'absolute',
		width: TRACK_WIDTH,
	},
	fill: {
		borderRadius: TRACK_WIDTH / 2,
		position: 'absolute',
		width: TRACK_WIDTH,
	},
	thumb: {
		borderRadius: THUMB_SIZE / 2,
		elevation: 2,
		height: THUMB_SIZE,
		position: 'absolute',
		width: THUMB_SIZE,
	},
	frequencyLabel: {
		opacity: 0.85,
	},
})

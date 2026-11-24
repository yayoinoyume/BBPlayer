import {
	EQ_DEFAULT_SAMPLE_RATE,
	computeEqFrequencyResponse,
	generateLogFrequencyPoints,
} from '@bbplayer/orpheus'
import { useCallback, useMemo, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import Svg, {
	Defs,
	Line,
	LinearGradient,
	Path,
	Stop,
	Text as SvgText,
} from 'react-native-svg'

const CURVE_HEIGHT = 176

const CURVE_POINT_COUNT = 128

const CURVE_RANGE_DB = 18

const MIN_FREQUENCY_HZ = 20

const MAX_FREQUENCY_HZ = 20000

const CHART_PADDING_LEFT = 26

const CHART_PADDING_RIGHT = 6

const CHART_PADDING_TOP = 10

const CHART_PADDING_BOTTOM = 20

const GRID_LEVELS_DB = [12, 6, 0, -6, -12] as const

const AXIS_LABELS_DB = [12, 0, -12] as const

const FREQUENCY_MARKS = [
	{ hz: 100, label: '100' },
	{ hz: 1000, label: '1k' },
	{ hz: 10000, label: '10k' },
] as const

const FREQUENCY_POINTS = generateLogFrequencyPoints(CURVE_POINT_COUNT)

interface CurvePoint {
	x: number
	y: number
}

export interface EqResponseCurveProps {
	gainsDb: readonly number[]
	preampDb: number
	enabled: boolean
}

function frequencyToRatio(frequency: number): number {
	const ratio =
		Math.log(frequency / MIN_FREQUENCY_HZ) /
		Math.log(MAX_FREQUENCY_HZ / MIN_FREQUENCY_HZ)

	return Math.min(Math.max(ratio, 0), 1)
}

function buildSmoothPath(points: readonly CurvePoint[]): string {
	const first = points[0]

	if (!first) return ''

	let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`

	for (let index = 1; index < points.length - 1; index += 1) {
		const point = points[index]

		const next = points[index + 1]

		if (!point || !next) continue

		const midX = (point.x + next.x) / 2

		const midY = (point.y + next.y) / 2

		path += ` Q ${point.x.toFixed(2)} ${point.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`
	}

	const last = points[points.length - 1]

	if (last && points.length > 1) {
		path += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
	}

	return path
}

export default function EqResponseCurve({
	gainsDb,
	preampDb,
	enabled,
}: EqResponseCurveProps) {
	const { colors } = useTheme()

	const [width, setWidth] = useState(0)

	const handleLayout = useCallback((event: LayoutChangeEvent) => {
		const nextWidth = event.nativeEvent.layout.width

		setWidth((previous) => (previous === nextWidth ? previous : nextWidth))
	}, [])

	const chartWidth = Math.max(
		width - CHART_PADDING_LEFT - CHART_PADDING_RIGHT,
		0,
	)

	const chartHeight = CURVE_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM

	const geometry = useMemo(() => {
		if (chartWidth <= 0 || chartHeight <= 0) return null

		const response = computeEqFrequencyResponse(
			gainsDb,
			preampDb,
			EQ_DEFAULT_SAMPLE_RATE,
			FREQUENCY_POINTS,
		)

		const centerY = CHART_PADDING_TOP + chartHeight / 2

		const scale = chartHeight / 2 / CURVE_RANGE_DB

		const points: CurvePoint[] = response.map((gainDb, index) => {
			const frequency = FREQUENCY_POINTS[index] ?? MIN_FREQUENCY_HZ

			const clamped = Math.min(
				Math.max(gainDb, -CURVE_RANGE_DB),
				CURVE_RANGE_DB,
			)

			return {
				x: CHART_PADDING_LEFT + frequencyToRatio(frequency) * chartWidth,
				y: centerY - clamped * scale,
			}
		})

		const linePath = buildSmoothPath(points)

		const first = points[0]

		const last = points[points.length - 1]

		const fillPath =
			first && last
				? `${linePath} L ${last.x.toFixed(2)} ${centerY.toFixed(2)} L ${first.x.toFixed(2)} ${centerY.toFixed(2)} Z`
				: ''

		return {
			centerY,
			linePath,
			fillPath,
			yForLevel: (levelDb: number) => centerY - levelDb * scale,
		}
	}, [chartHeight, chartWidth, gainsDb, preampDb])

	const strokeColor = enabled ? colors.primary : colors.outline

	const labelColor = colors.onSurfaceVariant

	return (
		<View
			style={styles.container}
			onLayout={handleLayout}
		>
			{geometry ? (
				<Svg
					width={width}
					height={CURVE_HEIGHT}
				>
					<Defs>
						<LinearGradient
							id='eqResponseFill'
							x1='0'
							y1='0'
							x2='0'
							y2='1'
						>
							<Stop
								offset='0'
								stopColor={strokeColor}
								stopOpacity={enabled ? 0.32 : 0.12}
							/>
							<Stop
								offset='1'
								stopColor={strokeColor}
								stopOpacity={0}
							/>
						</LinearGradient>
					</Defs>
					{GRID_LEVELS_DB.map((levelDb) => (
						<Line
							key={`grid-${levelDb}`}
							x1={CHART_PADDING_LEFT}
							x2={CHART_PADDING_LEFT + chartWidth}
							y1={geometry.yForLevel(levelDb)}
							y2={geometry.yForLevel(levelDb)}
							stroke={levelDb === 0 ? colors.outline : colors.outlineVariant}
							strokeWidth={1}
							strokeDasharray={levelDb === 0 ? undefined : '4 6'}
							opacity={levelDb === 0 ? 0.9 : 0.6}
						/>
					))}
					{FREQUENCY_MARKS.map((mark) => (
						<Line
							key={`mark-${mark.hz}`}
							x1={CHART_PADDING_LEFT + frequencyToRatio(mark.hz) * chartWidth}
							x2={CHART_PADDING_LEFT + frequencyToRatio(mark.hz) * chartWidth}
							y1={CHART_PADDING_TOP}
							y2={CHART_PADDING_TOP + chartHeight}
							stroke={colors.outlineVariant}
							strokeWidth={1}
							strokeDasharray='2 8'
							opacity={0.5}
						/>
					))}
					<Path
						d={geometry.fillPath}
						fill='url(#eqResponseFill)'
					/>
					<Path
						d={geometry.linePath}
						fill='none'
						stroke={strokeColor}
						strokeWidth={enabled ? 2.5 : 1.5}
						strokeLinecap='round'
						strokeLinejoin='round'
						opacity={enabled ? 1 : 0.7}
					/>
					{AXIS_LABELS_DB.map((levelDb) => (
						<SvgText
							key={`axis-${levelDb}`}
							x={CHART_PADDING_LEFT - 6}
							y={geometry.yForLevel(levelDb) + 3}
							fill={labelColor}
							fontSize={9}
							textAnchor='end'
						>
							{levelDb > 0 ? `+${levelDb}` : `${levelDb}`}
						</SvgText>
					))}
					{FREQUENCY_MARKS.map((mark) => (
						<SvgText
							key={`label-${mark.hz}`}
							x={CHART_PADDING_LEFT + frequencyToRatio(mark.hz) * chartWidth}
							y={CURVE_HEIGHT - 6}
							fill={labelColor}
							fontSize={9}
							textAnchor='middle'
						>
							{mark.label}
						</SvgText>
					))}
				</Svg>
			) : (
				<View style={styles.placeholder} />
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		height: CURVE_HEIGHT,
		width: '100%',
	},
	placeholder: {
		height: CURVE_HEIGHT,
	},
})

import type {
	AudioQualityInfo,
	AudioQualityPreference,
} from '@bbplayer/orpheus'

export interface AudioQualityOption {
	value: AudioQualityPreference
	label: string
	badge: string
	description: string
}

export interface ActualAudioQualityDescription {
	title: string
	subtitle?: string
}

const AUDIO_QUALITY_BY_PREFERENCE = {
	low: {
		value: 'low',
		label: '省流',
		badge: '64k',
		description: '约 64kbps，最省流量，适合流量紧张时听个响。',
	},
	standard: {
		value: 'standard',
		label: '标准',
		badge: '132k',
		description: '约 132kbps，普通耳机够用，比省流更耐听。',
	},
	high: {
		value: 'high',
		label: '高品',
		badge: '192k',
		description: '约 192kbps，音质与流量均衡（默认）。',
	},
	hires: {
		value: 'hires',
		label: 'Hi-Res 无损',
		badge: '无损',
		description: 'B 站 Hi-Res 无损音源，需登录且有大会员，不支持时自动降级。',
	},
	dolby: {
		value: 'dolby',
		label: '杜比全景声',
		badge: '杜比',
		description:
			'B 站杜比全景声音源，需视频本身支持与大会员，不支持时自动降级。',
	},
} satisfies Record<AudioQualityPreference, AudioQualityOption>

export const AUDIO_QUALITY_OPTIONS = [
	AUDIO_QUALITY_BY_PREFERENCE.low,
	AUDIO_QUALITY_BY_PREFERENCE.standard,
	AUDIO_QUALITY_BY_PREFERENCE.high,
	AUDIO_QUALITY_BY_PREFERENCE.hires,
	AUDIO_QUALITY_BY_PREFERENCE.dolby,
] satisfies readonly AudioQualityOption[]

const NORMAL_STREAM_PREFERENCES = new Map<number, AudioQualityPreference>([
	[30216, 'low'],
	[30232, 'standard'],
	[30280, 'high'],
])

const FALLBACK_HINT = '该曲不支持所选档位或权限不足，已自动降级'

interface ActualKindDescription {
	title: string
	detail?: string
}

export function getAudioQualityOption(
	preference: AudioQualityPreference | undefined,
): AudioQualityOption {
	const option = preference
		? AUDIO_QUALITY_BY_PREFERENCE[preference]
		: undefined

	return option ?? AUDIO_QUALITY_BY_PREFERENCE.high
}

export function formatAudioQualityLabel(
	preference: AudioQualityPreference,
): string {
	const option = getAudioQualityOption(preference)

	if (option.label.includes(option.badge)) {
		return option.label
	}

	return `${option.label} (${option.badge})`
}

function formatBandwidth(bandwidth: number | null): string | undefined {
	if (bandwidth === null || bandwidth <= 0) {
		return undefined
	}

	const kbps = Math.round(bandwidth / 1000)

	return kbps > 0 ? `约 ${kbps} kbps` : undefined
}

function describeActualKind(info: AudioQualityInfo): ActualKindDescription {
	const bandwidth = formatBandwidth(info.bandwidth)

	if (info.actualKind === 'dolby') {
		return { title: '杜比全景声', detail: bandwidth ?? 'B 站杜比全景声音源' }
	}

	if (info.actualKind === 'hires') {
		return { title: 'Hi-Res 无损', detail: bandwidth ?? 'B 站 Hi-Res 无损音源' }
	}

	if (info.actualKind === 'durl') {
		return { title: '普通整段音轨', detail: '老视频只有整段音轨，无法单独选档' }
	}

	if (info.actualKind === 'unknown') {
		return { title: '识别中', detail: '正在解析音源信息' }
	}

	const preference =
		info.actualStreamId === null
			? undefined
			: NORMAL_STREAM_PREFERENCES.get(info.actualStreamId)

	if (preference) {
		const option = AUDIO_QUALITY_BY_PREFERENCE[preference]

		return { title: `${option.label} ${option.badge}`, detail: bandwidth }
	}

	return { title: 'B 站普通音轨', detail: bandwidth }
}

export function formatActualAudioQuality(
	info: AudioQualityInfo | null,
): ActualAudioQualityDescription | null {
	if (info === null) {
		return null
	}

	if (info.actualKind === 'local' || info.isFromDownloadCache) {
		return {
			title: '离线已下载缓存',
			subtitle: '正在播放本地文件，不受音质偏好影响',
		}
	}

	const detail = describeActualKind(info)
	const notes: string[] = []

	if (detail.detail) {
		notes.push(detail.detail)
	}

	if (info.isFallback) {
		notes.push(FALLBACK_HINT)
	}

	return {
		title: detail.title,
		subtitle: notes.length > 0 ? notes.join(' · ') : undefined,
	}
}

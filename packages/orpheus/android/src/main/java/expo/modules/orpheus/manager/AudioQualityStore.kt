package expo.modules.orpheus.manager

import expo.modules.orpheus.bilibili.BilibiliAudioQualityId
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

data class AudioQualityInfo(
    val preferredQuality: String,
    val actualKind: String,
    val actualStreamId: Int?,
    val codecs: String?,
    val bandwidth: Long?,
    val isFallback: Boolean,
    val isFromDownloadCache: Boolean,
) {
    fun toMap(): Map<String, Any?> = mapOf(
        "preferredQuality" to preferredQuality,
        "actualKind" to actualKind,
        "actualStreamId" to actualStreamId,
        "codecs" to codecs,
        "bandwidth" to bandwidth,
        "isFallback" to isFallback,
        "isFromDownloadCache" to isFromDownloadCache,
    )
}

data class AudioQualityRequest(
    val preference: String,
    val audioQuality: Int,
    val enableDolby: Boolean,
    val enableHiRes: Boolean,
)

object AudioQualityStore {
    const val PREF_LOW = "low"
    const val PREF_STANDARD = "standard"
    const val PREF_HIGH = "high"
    const val PREF_HIRES = "hires"
    const val PREF_DOLBY = "dolby"

    const val KIND_DOLBY = "dolby"
    const val KIND_HIRES = "hires"
    const val KIND_NORMAL = "normal"
    const val KIND_DURL = "durl"
    const val KIND_LOCAL = "local"
    const val KIND_UNKNOWN = "unknown"

    private val preferences = setOf(PREF_LOW, PREF_STANDARD, PREF_HIGH, PREF_HIRES, PREF_DOLBY)
    private val infos = ConcurrentHashMap<String, AudioQualityInfo>()
    private val listeners = CopyOnWriteArrayList<(String, AudioQualityInfo) -> Unit>()

    fun isValidPreference(value: String?): Boolean = value != null && preferences.contains(value)

    fun normalizePreference(value: String?): String {
        return if (value != null && preferences.contains(value)) value else PREF_HIGH
    }

    fun requestFor(preference: String): AudioQualityRequest {
        return when (normalizePreference(preference)) {
            PREF_LOW -> AudioQualityRequest(PREF_LOW, BilibiliAudioQualityId.LOW, false, false)
            PREF_STANDARD -> AudioQualityRequest(PREF_STANDARD, BilibiliAudioQualityId.STANDARD, false, false)
            PREF_HIRES -> AudioQualityRequest(PREF_HIRES, BilibiliAudioQualityId.HIGH, false, true)
            PREF_DOLBY -> AudioQualityRequest(PREF_DOLBY, BilibiliAudioQualityId.HIGH, true, true)
            else -> AudioQualityRequest(PREF_HIGH, BilibiliAudioQualityId.HIGH, false, false)
        }
    }

    fun preferenceForStreamId(id: Int): String? = when (id) {
        BilibiliAudioQualityId.LOW -> PREF_LOW
        BilibiliAudioQualityId.STANDARD -> PREF_STANDARD
        BilibiliAudioQualityId.HIGH -> PREF_HIGH
        else -> null
    }

    fun preferenceFromQuery(query: String?): String? {
        if (query.isNullOrBlank()) return null
        if (preferences.contains(query)) return query
        return query.toIntOrNull()?.let { preferenceForStreamId(it) }
    }

    fun isFallback(preferred: String, actualKind: String, actualStreamId: Int?): Boolean {
        val preference = normalizePreference(preferred)
        if (preference == PREF_DOLBY) return actualKind != KIND_DOLBY
        if (preference == PREF_HIRES) return actualKind != KIND_HIRES
        if (actualKind == KIND_DOLBY || actualKind == KIND_HIRES) return false
        if (actualKind != KIND_NORMAL) return true
        return (actualStreamId ?: 0) < requestFor(preference).audioQuality
    }

    fun put(uri: String, info: AudioQualityInfo) {
        infos[uri] = info
        listeners.forEach { listener -> listener(uri, info) }
    }

    fun get(uri: String): AudioQualityInfo? = infos[uri]

    fun clear(uri: String) {
        infos.remove(uri)
    }

    fun addListener(listener: (String, AudioQualityInfo) -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: (String, AudioQualityInfo) -> Unit) {
        listeners.remove(listener)
    }
}

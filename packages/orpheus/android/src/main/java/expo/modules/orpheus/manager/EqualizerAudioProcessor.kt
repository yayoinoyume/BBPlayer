package expo.modules.orpheus.manager

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor.AudioFormat
import androidx.media3.common.audio.AudioProcessor.StreamMetadata
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import java.nio.ByteOrder

@UnstableApi
class EqualizerAudioProcessor(
    private val configHolder: EqualizerConfigHolder = EqualizerConfigHolder,
) : BaseAudioProcessor() {
    private val dsp = EqualizerDsp(configHolder)

    override fun onConfigure(inputAudioFormat: AudioFormat): AudioFormat {
        val supportedEncoding = inputAudioFormat.encoding == C.ENCODING_PCM_16BIT ||
            inputAudioFormat.encoding == C.ENCODING_PCM_FLOAT
        if (!supportedEncoding || inputAudioFormat.sampleRate <= 0 || inputAudioFormat.channelCount <= 0) {
            return AudioFormat.NOT_SET
        }
        dsp.configure(inputAudioFormat.sampleRate, inputAudioFormat.channelCount)
        return inputAudioFormat
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val remaining = inputBuffer.remaining()
        if (remaining <= 0) return
        val output = replaceOutputBuffer(remaining)
        output.order(ByteOrder.nativeOrder())
        val state = configHolder.get()
        if (state.enabled) {
            when (inputAudioFormat.encoding) {
                C.ENCODING_PCM_16BIT -> dsp.processPcm16(inputBuffer, output)
                C.ENCODING_PCM_FLOAT -> dsp.processPcmFloat(inputBuffer, output)
                else -> output.put(inputBuffer)
            }
        } else {
            output.put(inputBuffer)
        }
        if (inputBuffer.hasRemaining()) inputBuffer.position(inputBuffer.limit())
        output.flip()
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onFlush() {
        dsp.reset()
    }

    override fun onFlush(streamMetadata: StreamMetadata) {
        dsp.reset()
    }

    override fun onReset() {
        dsp.reset()
    }
}

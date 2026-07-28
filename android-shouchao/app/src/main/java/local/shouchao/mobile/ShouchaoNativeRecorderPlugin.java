package local.shouchao.mobile;

import android.Manifest;
import android.media.MediaRecorder;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

@CapacitorPlugin(
    name = "ShouchaoNativeRecorder",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class ShouchaoNativeRecorderPlugin extends Plugin {
    private MediaRecorder recorder;
    private File outputFile;
    private long startedAt;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "recordPermissionCallback");
            return;
        }
        startRecording(call);
    }

    @PermissionCallback
    private void recordPermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startRecording(call);
        } else {
            call.reject("麦克风权限未开启");
        }
    }

    private void startRecording(PluginCall call) {
        if (recorder != null) {
            call.reject("正在录音中");
            return;
        }

        try {
            outputFile = new File(getContext().getCacheDir(), "shouchao-recording-" + System.currentTimeMillis() + ".m4a");
            MediaRecorder rec = new MediaRecorder();
            rec.setAudioSource(MediaRecorder.AudioSource.MIC);
            rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            rec.setAudioChannels(1);
            rec.setAudioSamplingRate(44100);
            rec.setAudioEncodingBitRate(128000);
            rec.setOutputFile(outputFile.getAbsolutePath());
            rec.prepare();
            rec.start();

            recorder = rec;
            startedAt = System.currentTimeMillis();

            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception ex) {
            cleanup();
            call.reject("原生录音启动失败: " + ex.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (recorder == null || outputFile == null) {
            call.reject("当前没有录音");
            return;
        }

        File file = outputFile;
        long durationMs = Math.max(0, System.currentTimeMillis() - startedAt);
        try {
            recorder.stop();
            recorder.release();
            recorder = null;

            byte[] bytes = readAllBytes(file);
            if (bytes.length == 0) {
                call.reject("没有录到声音，请重试");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("mimeType", "audio/mp4");
            ret.put("filename", "audio.m4a");
            ret.put("durationMs", durationMs);
            ret.put("size", bytes.length);
            ret.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
            call.resolve(ret);
        } catch (RuntimeException ex) {
            call.reject("录音时间太短或录音失败，请重试");
        } catch (Exception ex) {
            call.reject("原生录音停止失败: " + ex.getMessage());
        } finally {
            cleanupFile(file);
            outputFile = null;
            startedAt = 0;
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        cleanup();
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        cleanup();
        super.handleOnDestroy();
    }

    private void cleanup() {
        if (recorder != null) {
            try {
                recorder.release();
            } catch (Exception ignored) {
            }
            recorder = null;
        }
        cleanupFile(outputFile);
        outputFile = null;
        startedAt = 0;
    }

    private void cleanupFile(File file) {
        if (file != null && file.exists()) {
            try {
                file.delete();
            } catch (Exception ignored) {
            }
        }
    }

    private byte[] readAllBytes(File file) throws IOException {
        try (FileInputStream input = new FileInputStream(file);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }
}

import AVFoundation
import Capacitor
import Foundation

@objc(ShouchaoNativeRecorderPlugin)
public class ShouchaoNativeRecorderPlugin: CAPPlugin, CAPBridgedPlugin, AVAudioRecorderDelegate {
    public let identifier = "ShouchaoNativeRecorderPlugin"
    public let jsName = "ShouchaoNativeRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private var recorder: AVAudioRecorder?
    private var recordingURL: URL?
    private var startedAt: Date?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func start(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()

        session.requestRecordPermission { [weak self] granted in
            guard let self else { return }
            if !granted {
                call.reject("麦克风权限未开启，请在系统设置中允许搭子手抄访问麦克风")
                return
            }

            do {
                try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .allowBluetooth])
                try session.setActive(true)

                let filename = "shouchao-\(Int(Date().timeIntervalSince1970 * 1000)).m4a"
                let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
                let settings: [String: Any] = [
                    AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                    AVSampleRateKey: 44100,
                    AVNumberOfChannelsKey: 1,
                    AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
                    AVEncoderBitRateKey: 96000
                ]

                let recorder = try AVAudioRecorder(url: url, settings: settings)
                recorder.delegate = self
                recorder.isMeteringEnabled = false
                recorder.prepareToRecord()
                guard recorder.record() else {
                    call.reject("原生录音启动失败，请重试")
                    return
                }

                self.recorder = recorder
                self.recordingURL = url
                self.startedAt = Date()
                call.resolve(["ok": true])
            } catch {
                call.reject("原生录音启动失败：\(error.localizedDescription)")
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        guard let recorder else {
            call.reject("当前没有正在录制的音频")
            return
        }

        recorder.stop()
        self.recorder = nil

        guard let url = recordingURL else {
            call.reject("录音文件不存在，请重试")
            return
        }

        do {
            let data = try Data(contentsOf: url)
            if data.isEmpty {
                call.reject("没有录到声音，请重试")
                return
            }

            let durationMs = startedAt.map { max(0, Int(Date().timeIntervalSince($0) * 1000)) } ?? 0
            call.resolve([
                "ok": true,
                "base64": data.base64EncodedString(),
                "mimeType": "audio/mp4",
                "filename": url.lastPathComponent,
                "durationMs": durationMs,
                "size": data.count
            ])
        } catch {
            call.reject("读取录音失败：\(error.localizedDescription)")
        }

        cleanupRecordingFile()
        deactivateAudioSession()
    }

    @objc func cancel(_ call: CAPPluginCall) {
        recorder?.stop()
        recorder = nil
        cleanupRecordingFile()
        deactivateAudioSession()
        call.resolve(["ok": true])
    }

    private func cleanupRecordingFile() {
        if let url = recordingURL {
            try? FileManager.default.removeItem(at: url)
        }
        recordingURL = nil
        startedAt = nil
    }

    private func deactivateAudioSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

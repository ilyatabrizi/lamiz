import AVFoundation
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let url = URL(fileURLWithPath: args[1])
let outDir = args[2]
let times = args[3].split(separator: ",").map { Double($0)! }
let asset = AVURLAsset(url: url)
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
for t in times {
    let cm = CMTime(seconds: t, preferredTimescale: 600)
    do {
        let img = try gen.copyCGImage(at: cm, actualTime: nil)
        let out = URL(fileURLWithPath: outDir + "/f" + String(format: "%05.2f", t) + ".png")
        let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil)!
        CGImageDestinationAddImage(dest, img, nil)
        CGImageDestinationFinalize(dest)
        print("ok", t, img.width, img.height)
    } catch { print("err", t, error) }
}

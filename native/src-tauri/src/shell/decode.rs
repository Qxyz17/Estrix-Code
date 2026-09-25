//! 输出编码检测与转换
//!
//! Windows 下 cmd 输出多为 GBK，PowerShell 多为 UTF-8。
//! 这里做一次尽力而为的检测：先按 UTF-8 解码，失败则按 GBK。

use encoding_rs::GBK;

/// 将原始字节解码为 UTF-8 字符串。
///
/// 策略：
/// 1. 先尝试严格 UTF-8（std::str::from_utf8）
/// 2. 失败则用 GBK 解码
/// 3. 再失败则用 lossy UTF-8 兜底
pub fn decode_output(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => {
            let (cow, _, had_errors) = GBK.decode(bytes);
            if had_errors {
                String::from_utf8_lossy(bytes).to_string()
            } else {
                cow.into_owned()
            }
        }
    }
}

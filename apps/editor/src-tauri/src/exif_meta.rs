use std::fs;
use std::io::BufReader;
use std::path::Path;

use chrono::{FixedOffset, NaiveDateTime, SecondsFormat, TimeZone};
use exif::{In, Tag, Value};
use little_exif::exif_tag::ExifTag;
use little_exif::filetype::FileExtension;
use little_exif::metadata::Metadata;
use little_exif::rational::{iR64, uR64};
use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Whitelist {
    pub date_time: Option<String>,
    pub date_time_original: Option<String>,
    pub date_time_digitized: Option<String>,
    pub offset_time: Option<String>,
    pub offset_time_original: Option<String>,
    pub offset_time_digitized: Option<String>,
    pub sub_sec_time: Option<String>,
    pub sub_sec_time_original: Option<String>,
    pub sub_sec_time_digitized: Option<String>,
    pub lens_make: Option<String>,
    pub lens_model: Option<String>,
    pub lens_info: Option<Vec<(u32, u32)>>,
    pub focal_length: Option<(u32, u32)>,
    pub focal_length_35: Option<u16>,
    pub exposure_time: Option<(u32, u32)>,
    pub f_number: Option<(u32, u32)>,
    pub iso: Option<Vec<u16>>,
    pub exposure_program: Option<u16>,
    pub exposure_compensation: Option<(i32, u32)>,
    pub metering_mode: Option<u16>,
    pub flash: Option<u16>,
    pub aperture_value: Option<(u32, u32)>,
    pub max_aperture_value: Option<(u32, u32)>,
    pub shutter_speed_value: Option<(i32, u32)>,
    pub brightness_value: Option<(i32, u32)>,
    pub exposure_mode: Option<u16>,
}

impl Whitelist {
    pub fn has_any(&self) -> bool {
        self.date_time.is_some()
            || self.date_time_original.is_some()
            || self.date_time_digitized.is_some()
            || self.offset_time.is_some()
            || self.offset_time_original.is_some()
            || self.offset_time_digitized.is_some()
            || self.sub_sec_time.is_some()
            || self.sub_sec_time_original.is_some()
            || self.sub_sec_time_digitized.is_some()
            || self.lens_make.is_some()
            || self.lens_model.is_some()
            || self.lens_info.is_some()
            || self.focal_length.is_some()
            || self.focal_length_35.is_some()
            || self.exposure_time.is_some()
            || self.f_number.is_some()
            || self.iso.is_some()
            || self.exposure_program.is_some()
            || self.exposure_compensation.is_some()
            || self.metering_mode.is_some()
            || self.flash.is_some()
            || self.aperture_value.is_some()
            || self.max_aperture_value.is_some()
            || self.shutter_speed_value.is_some()
            || self.brightness_value.is_some()
            || self.exposure_mode.is_some()
    }

    pub fn to_metadata(&self) -> Metadata {
        let mut metadata = Metadata::new();
        if let Some(value) = &self.date_time {
            metadata.set_tag(ExifTag::ModifyDate(value.clone()));
        }
        if let Some(value) = &self.date_time_original {
            metadata.set_tag(ExifTag::DateTimeOriginal(value.clone()));
        }
        if let Some(value) = &self.date_time_digitized {
            metadata.set_tag(ExifTag::CreateDate(value.clone()));
        }
        if let Some(value) = &self.offset_time {
            metadata.set_tag(ExifTag::OffsetTime(value.clone()));
        }
        if let Some(value) = &self.offset_time_original {
            metadata.set_tag(ExifTag::OffsetTimeOriginal(value.clone()));
        }
        if let Some(value) = &self.offset_time_digitized {
            metadata.set_tag(ExifTag::OffsetTimeDigitized(value.clone()));
        }
        if let Some(value) = &self.sub_sec_time {
            metadata.set_tag(ExifTag::SubSecTime(value.clone()));
        }
        if let Some(value) = &self.sub_sec_time_original {
            metadata.set_tag(ExifTag::SubSecTimeOriginal(value.clone()));
        }
        if let Some(value) = &self.sub_sec_time_digitized {
            metadata.set_tag(ExifTag::SubSecTimeDigitized(value.clone()));
        }
        if let Some(value) = &self.lens_make {
            metadata.set_tag(ExifTag::LensMake(value.clone()));
        }
        if let Some(value) = &self.lens_model {
            metadata.set_tag(ExifTag::LensModel(value.clone()));
        }
        if let Some(values) = &self.lens_info {
            metadata.set_tag(ExifTag::LensInfo(
                values
                    .iter()
                    .map(|(n, d)| uR64 {
                        nominator: *n,
                        denominator: *d,
                    })
                    .collect(),
            ));
        }
        if let Some(value) = self.focal_length {
            metadata.set_tag(ExifTag::FocalLength(vec![uR64 {
                nominator: value.0,
                denominator: value.1,
            }]));
        }
        if let Some(value) = self.focal_length_35 {
            metadata.set_tag(ExifTag::FocalLengthIn35mmFormat(vec![value]));
        }
        if let Some(value) = self.exposure_time {
            metadata.set_tag(ExifTag::ExposureTime(vec![uR64 {
                nominator: value.0,
                denominator: value.1,
            }]));
        }
        if let Some(value) = self.f_number {
            metadata.set_tag(ExifTag::FNumber(vec![uR64 {
                nominator: value.0,
                denominator: value.1,
            }]));
        }
        if let Some(values) = &self.iso {
            metadata.set_tag(ExifTag::ISO(values.clone()));
        }
        if let Some(value) = self.exposure_program {
            metadata.set_tag(ExifTag::ExposureProgram(vec![value]));
        }
        if let Some(value) = self.exposure_compensation {
            metadata.set_tag(ExifTag::ExposureCompensation(vec![iR64 {
                nominator: value.0,
                denominator: value.1 as i32,
            }]));
        }
        if let Some(value) = self.metering_mode {
            metadata.set_tag(ExifTag::MeteringMode(vec![value]));
        }
        if let Some(value) = self.flash {
            metadata.set_tag(ExifTag::Flash(vec![value]));
        }
        if let Some(value) = self.aperture_value {
            metadata.set_tag(ExifTag::ApertureValue(vec![uR64 {
                nominator: value.0,
                denominator: value.1,
            }]));
        }
        if let Some(value) = self.max_aperture_value {
            metadata.set_tag(ExifTag::MaxApertureValue(vec![uR64 {
                nominator: value.0,
                denominator: value.1,
            }]));
        }
        if let Some(value) = self.shutter_speed_value {
            metadata.set_tag(ExifTag::ShutterSpeedValue(vec![iR64 {
                nominator: value.0,
                denominator: value.1 as i32,
            }]));
        }
        if let Some(value) = self.brightness_value {
            metadata.set_tag(ExifTag::BrightnessValue(vec![iR64 {
                nominator: value.0,
                denominator: value.1 as i32,
            }]));
        }
        if let Some(value) = self.exposure_mode {
            metadata.set_tag(ExifTag::ExposureMode(vec![value]));
        }
        metadata
    }
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoExif {
    pub date: Option<String>,
    pub captured_at: Option<String>,
    pub orientation: u32,
    pub whitelist: Whitelist,
    pub warning: Option<String>,
}

pub fn read_photo_exif(path: &Path) -> AppResult<PhotoExif> {
    let file = fs::File::open(path)?;
    let mut reader = BufReader::new(file);
    let exif = match exif::Reader::new().read_from_container(&mut reader) {
        Ok(exif) => exif,
        Err(exif::Error::NotFound(_)) => {
            return Ok(PhotoExif {
                orientation: 1,
                ..PhotoExif::default()
            })
        }
        Err(error) => {
            return Ok(PhotoExif {
                orientation: 1,
                warning: Some(format!("EXIF 无法解析，已按无拍摄时间处理：{error}")),
                ..PhotoExif::default()
            })
        }
    };

    let orientation = get_short(&exif, Tag::Orientation).unwrap_or(1);
    let whitelist = Whitelist {
        date_time: get_ascii(&exif, Tag::DateTime),
        date_time_original: get_ascii(&exif, Tag::DateTimeOriginal),
        date_time_digitized: get_ascii(&exif, Tag::DateTimeDigitized),
        offset_time: get_ascii(&exif, Tag::OffsetTime),
        offset_time_original: get_ascii(&exif, Tag::OffsetTimeOriginal),
        offset_time_digitized: get_ascii(&exif, Tag::OffsetTimeDigitized),
        sub_sec_time: get_ascii(&exif, Tag::SubSecTime),
        sub_sec_time_original: get_ascii(&exif, Tag::SubSecTimeOriginal),
        sub_sec_time_digitized: get_ascii(&exif, Tag::SubSecTimeDigitized),
        lens_make: get_ascii(&exif, Tag::LensMake),
        lens_model: get_ascii(&exif, Tag::LensModel),
        lens_info: get_rationals(&exif, Tag::LensSpecification, 4),
        focal_length: get_rational(&exif, Tag::FocalLength),
        focal_length_35: get_short(&exif, Tag::FocalLengthIn35mmFilm),
        exposure_time: get_rational(&exif, Tag::ExposureTime),
        f_number: get_rational(&exif, Tag::FNumber),
        iso: get_shorts(&exif, Tag::PhotographicSensitivity),
        exposure_program: get_short(&exif, Tag::ExposureProgram),
        exposure_compensation: get_srational(&exif, Tag::ExposureBiasValue),
        metering_mode: get_short(&exif, Tag::MeteringMode),
        flash: get_short(&exif, Tag::Flash),
        aperture_value: get_rational(&exif, Tag::ApertureValue),
        max_aperture_value: get_rational(&exif, Tag::MaxApertureValue),
        shutter_speed_value: get_srational(&exif, Tag::ShutterSpeedValue),
        brightness_value: get_srational(&exif, Tag::BrightnessValue),
        exposure_mode: get_short(&exif, Tag::ExposureMode),
    };

    let (date, captured_at) = resolve_date(&whitelist);
    Ok(PhotoExif {
        date,
        captured_at,
        orientation: orientation.into(),
        whitelist,
        warning: None,
    })
}

fn resolve_date(whitelist: &Whitelist) -> (Option<String>, Option<String>) {
    let candidates = [
        (
            whitelist.date_time_original.as_deref(),
            whitelist.offset_time_original.as_deref(),
        ),
        (
            whitelist.date_time_digitized.as_deref(),
            whitelist.offset_time_digitized.as_deref(),
        ),
        (
            whitelist.date_time.as_deref(),
            whitelist.offset_time.as_deref(),
        ),
    ];
    for (time, offset) in candidates {
        let Some(time) = time else { continue };
        let naive = NaiveDateTime::parse_from_str(time, "%Y:%m:%d %H:%M:%S")
            .or_else(|_| NaiveDateTime::parse_from_str(time, "%Y-%m-%d %H:%M:%S"))
            .ok();
        let Some(naive) = naive else {
            continue;
        };
        if let Some(offset) = offset.and_then(parse_offset) {
            if let Some(datetime) = offset.from_local_datetime(&naive).single() {
                return (
                    Some(datetime.date_naive().format("%Y-%m-%d").to_string()),
                    Some(datetime.to_rfc3339_opts(SecondsFormat::Secs, false)),
                );
            }
        }
        return (Some(naive.date().format("%Y-%m-%d").to_string()), None);
    }
    (None, None)
}

fn parse_offset(value: &str) -> Option<FixedOffset> {
    let value = value.trim();
    if value.len() != 6 {
        return None;
    }
    let sign = match &value[0..1] {
        "+" => 1,
        "-" => -1,
        _ => return None,
    };
    let hours: i32 = value[1..3].parse().ok()?;
    let minutes: i32 = value[4..6].parse().ok()?;
    if hours > 23 || minutes > 59 {
        return None;
    }
    FixedOffset::east_opt(sign * (hours * 3600 + minutes * 60))
}

fn field_value(exif: &exif::Exif, tag: Tag) -> Option<&Value> {
    exif.get_field(tag, In::PRIMARY).map(|field| &field.value)
}

fn get_ascii(exif: &exif::Exif, tag: Tag) -> Option<String> {
    match field_value(exif, tag) {
        Some(Value::Ascii(values)) => {
            let bytes = values.first()?;
            let bytes = bytes.strip_suffix(&[0]).unwrap_or(bytes);
            Some(String::from_utf8_lossy(bytes).trim().to_string())
                .filter(|value| !value.is_empty())
        }
        _ => None,
    }
}

fn get_short(exif: &exif::Exif, tag: Tag) -> Option<u16> {
    match field_value(exif, tag) {
        Some(Value::Short(values)) => values.first().copied(),
        _ => None,
    }
}

fn get_shorts(exif: &exif::Exif, tag: Tag) -> Option<Vec<u16>> {
    match field_value(exif, tag) {
        Some(Value::Short(values)) => Some(values.clone()),
        _ => None,
    }
}

fn get_rational(exif: &exif::Exif, tag: Tag) -> Option<(u32, u32)> {
    match field_value(exif, tag) {
        Some(Value::Rational(values)) => values.first().map(|value| (value.num, value.denom)),
        _ => None,
    }
}

fn get_rationals(exif: &exif::Exif, tag: Tag, max: usize) -> Option<Vec<(u32, u32)>> {
    match field_value(exif, tag) {
        Some(Value::Rational(values)) => {
            let collected: Vec<_> = values
                .iter()
                .take(max)
                .map(|value| (value.num, value.denom))
                .collect();
            (!collected.is_empty()).then_some(collected)
        }
        _ => None,
    }
}

fn get_srational(exif: &exif::Exif, tag: Tag) -> Option<(i32, u32)> {
    match field_value(exif, tag) {
        Some(Value::SRational(values)) => values
            .first()
            .map(|value| (value.num, value.denom.unsigned_abs())),
        _ => None,
    }
}

pub fn apply_whitelist_to_bytes(
    bytes: &mut Vec<u8>,
    width: u32,
    height: u32,
    whitelist: &Whitelist,
) -> AppResult<()> {
    if !whitelist.has_any() {
        return Ok(());
    }
    ensure_extended_webp(bytes, width, height)?;
    whitelist
        .to_metadata()
        .write_to_vec(bytes, FileExtension::WEBP)
        .map_err(|error| {
            AppError::new(
                "EXIF_METADATA_FAILED",
                format!("EXIF 白名单写入失败：{error}"),
            )
        })
}

fn ensure_extended_webp(bytes: &mut Vec<u8>, width: u32, height: u32) -> AppResult<()> {
    if bytes.len() < 16 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WEBP" {
        return Err(AppError::new("IMAGE_INVALID", "不是有效的 WebP 文件"));
    }
    if &bytes[12..16] == b"VP8X" {
        return Ok(());
    }
    let mut chunks: Vec<(String, Vec<u8>)> = Vec::new();
    let mut cursor = 12usize;
    while cursor + 8 <= bytes.len() {
        let fourcc = String::from_utf8_lossy(&bytes[cursor..cursor + 4]).to_string();
        let size = u32::from_le_bytes(bytes[cursor + 4..cursor + 8].try_into().unwrap()) as usize;
        let start = cursor + 8;
        let end = start
            .checked_add(size)
            .ok_or_else(|| AppError::new("IMAGE_INVALID", "WebP 数据块长度无效"))?;
        if end > bytes.len() {
            return Err(AppError::new("IMAGE_INVALID", "WebP 数据块越界"));
        }
        if matches!(fourcc.as_str(), "VP8 " | "VP8L" | "ALPH") {
            chunks.push((fourcc, bytes[start..end].to_vec()));
        }
        cursor = end + (size % 2);
    }
    if chunks.is_empty() {
        return Err(AppError::new("IMAGE_INVALID", "WebP 中没有图像数据块"));
    }

    let has_alpha = chunks.iter().any(|(fourcc, _)| fourcc == "ALPH");
    let flags = 0x08u8 | if has_alpha { 0x10 } else { 0 };
    let mut vp8x = Vec::with_capacity(10);
    vp8x.push(flags);
    vp8x.extend([0, 0, 0]);
    let canvas_w = width.saturating_sub(1).min(0x00ff_ffff);
    let canvas_h = height.saturating_sub(1).min(0x00ff_ffff);
    vp8x.extend(canvas_w.to_le_bytes()[0..3].iter().copied());
    vp8x.extend(canvas_h.to_le_bytes()[0..3].iter().copied());

    let mut output = Vec::new();
    output.extend_from_slice(b"RIFF");
    output.extend_from_slice(&0u32.to_le_bytes());
    output.extend_from_slice(b"WEBP");
    append_chunk(&mut output, b"VP8X", &vp8x);
    for (fourcc, data) in chunks {
        append_chunk(&mut output, fourcc.as_bytes(), &data);
    }
    let riff_size = (output.len() - 8) as u32;
    output[4..8].copy_from_slice(&riff_size.to_le_bytes());
    *bytes = output;
    Ok(())
}

fn append_chunk(output: &mut Vec<u8>, fourcc: &[u8], data: &[u8]) {
    output.extend_from_slice(fourcc);
    output.extend_from_slice(&(data.len() as u32).to_le_bytes());
    output.extend_from_slice(data);
    if data.len() % 2 == 1 {
        output.push(0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_offsets() {
        assert_eq!(parse_offset("+08:00").unwrap().local_minus_utc(), 8 * 3600);
        assert_eq!(parse_offset("-05:00").unwrap().local_minus_utc(), -5 * 3600);
        assert!(parse_offset("08:00").is_none());
    }

    #[test]
    fn resolves_wall_clock_date_without_offset() {
        let whitelist = Whitelist {
            date_time_original: Some("2026-11-08 23:30:00".to_string()),
            ..Whitelist::default()
        };
        let (date, captured) = resolve_date(&whitelist);
        assert_eq!(date.as_deref(), Some("2026-11-08"));
        assert!(captured.is_none());
    }

    #[test]
    fn resolves_offset_date_without_utc_shift() {
        let whitelist = Whitelist {
            date_time_original: Some("2026-11-08 23:30:00".to_string()),
            offset_time_original: Some("+08:00".to_string()),
            ..Whitelist::default()
        };
        let (date, captured) = resolve_date(&whitelist);
        assert_eq!(date.as_deref(), Some("2026-11-08"));
        assert_eq!(captured.as_deref(), Some("2026-11-08T23:30:00+08:00"));
    }

    #[test]
    fn falls_back_to_digitized_and_modify_time() {
        let whitelist = Whitelist {
            date_time_digitized: Some("2026-11-08 00:10:00".to_string()),
            offset_time_digitized: Some("-05:00".to_string()),
            ..Whitelist::default()
        };
        let (date, captured) = resolve_date(&whitelist);
        assert_eq!(date.as_deref(), Some("2026-11-08"));
        assert_eq!(captured.as_deref(), Some("2026-11-08T00:10:00-05:00"));

        let whitelist = Whitelist {
            date_time: Some("2026-11-08 12:00:00".to_string()),
            ..Whitelist::default()
        };
        assert_eq!(resolve_date(&whitelist).0.as_deref(), Some("2026-11-08"));
    }
}

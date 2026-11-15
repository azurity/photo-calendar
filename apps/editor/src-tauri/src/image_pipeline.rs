use std::fs;
use std::path::Path;

use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::metadata::Orientation;
use image::{DynamicImage, GenericImageView, ImageReader, Limits};
use sha2::{Digest, Sha256};

use crate::error::{AppError, AppResult};
use crate::exif_meta::{apply_whitelist_to_bytes, PhotoExif};
use crate::fsutil::atomic_write;

pub const MAX_UPLOAD_BYTES: u64 = 50 * 1024 * 1024;
pub const MAX_IMAGE_PIXELS: u64 = 100_000_000;
pub const FULL_EDGE: u32 = 2400;
pub const THUMB_EDGE: u32 = 640;
pub const API_EDGE: u32 = 1568;
pub const API_MAX_BYTES: usize = 2 * 1024 * 1024;

#[allow(dead_code)]
pub struct ProcessedPhoto {
    pub photo: String,
    pub thumbnail: String,
    pub width: u32,
    pub height: u32,
}

pub fn decode_image(path: &Path) -> AppResult<DynamicImage> {
    let metadata = fs::metadata(path)?;
    if metadata.len() > MAX_UPLOAD_BYTES {
        return Err(AppError::new(
            "IMAGE_TOO_LARGE",
            format!("图片超过 {} MiB 上限", MAX_UPLOAD_BYTES / 1024 / 1024),
        ));
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "jpg" | "jpeg" | "png" | "webp") {
        return Err(AppError::new(
            "IMAGE_INVALID",
            format!("不支持的图片格式：{extension}（首版支持 JPEG/PNG/WebP）"),
        ));
    }

    let mut reader = ImageReader::open(path)?
        .with_guessed_format()
        .map_err(|error| AppError::new("IMAGE_INVALID", error.to_string()))?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(20_000);
    limits.max_image_height = Some(20_000);
    limits.max_alloc = Some(512 * 1024 * 1024);
    reader.limits(limits);
    let image = reader
        .decode()
        .map_err(|error| AppError::new("IMAGE_INVALID", format!("图片无法解码：{error}")))?;
    let (width, height) = image.dimensions();
    if u64::from(width) * u64::from(height) > MAX_IMAGE_PIXELS {
        return Err(AppError::new(
            "IMAGE_TOO_LARGE",
            "图片像素数超过 100 MP 上限",
        ));
    }
    Ok(image)
}

pub fn apply_orientation(image: DynamicImage, orientation: u32) -> DynamicImage {
    let mut image = image;
    let orientation =
        Orientation::from_exif(orientation.min(255) as u8).unwrap_or(Orientation::NoTransforms);
    image.apply_orientation(orientation);
    image
}

fn fit(image: &DynamicImage, edge: u32) -> DynamicImage {
    let (width, height) = image.dimensions();
    if width <= edge && height <= edge {
        return image.clone();
    }
    let scale = (edge as f64 / width as f64).min(edge as f64 / height as f64);
    let target_width = (width as f64 * scale).round().max(1.0) as u32;
    let target_height = (height as f64 * scale).round().max(1.0) as u32;
    image.resize_exact(target_width, target_height, FilterType::Lanczos3)
}

fn encode_webp(image: &DynamicImage, quality: f32) -> AppResult<Vec<u8>> {
    let rgba = image.to_rgba8();
    let encoder = webp::Encoder::from_rgba(&rgba, rgba.width(), rgba.height());
    let encoded = encoder.encode(quality);
    Ok(encoded.to_vec())
}

pub fn process_photo(
    source: &Path,
    root: &Path,
    date: &str,
    exif: &PhotoExif,
) -> AppResult<ProcessedPhoto> {
    let original = fs::read(source)?;
    let hash = Sha256::digest(&original);
    let hash8 = hex::encode(&hash[..4]);
    let stem = format!("{date}-{hash8}");
    let photo_rel = format!("data/photos/{stem}.webp");
    let thumb_rel = format!("data/photos/thumbs/{stem}.webp");
    let photo_path = root.join(&photo_rel);
    let thumb_path = root.join(&thumb_rel);

    let image = apply_orientation(decode_image(source)?, exif.orientation);
    let full = fit(&image, FULL_EDGE);
    let thumb = fit(&image, THUMB_EDGE);
    let (width, height) = full.dimensions();

    let mut full_bytes = encode_webp(&full, 82.0)?;
    apply_whitelist_to_bytes(&mut full_bytes, width, height, &exif.whitelist)?;
    let thumb_bytes = encode_webp(&thumb, 78.0)?;

    if let Some(parent) = photo_path.parent() {
        fs::create_dir_all(parent)?;
    }
    if let Some(parent) = thumb_path.parent() {
        fs::create_dir_all(parent)?;
    }

    atomic_write(&photo_path, &full_bytes)?;
    if let Err(error) = atomic_write(&thumb_path, &thumb_bytes) {
        let _ = fs::remove_file(&photo_path);
        return Err(error);
    }

    Ok(ProcessedPhoto {
        photo: photo_rel,
        thumbnail: thumb_rel,
        width,
        height,
    })
}

pub fn preview_data_url(path: &Path) -> AppResult<String> {
    let image = decode_image(path)?;
    let preview = fit(&image, 420);
    let rgb = preview.to_rgb8();
    let mut data = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut data, 72);
    encoder
        .encode_image(&DynamicImage::ImageRgb8(rgb))
        .map_err(|error| AppError::new("IMAGE_INVALID", error.to_string()))?;
    Ok(format!(
        "data:image/jpeg;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(data)
    ))
}

pub fn prepare_api_image(path: &Path) -> AppResult<String> {
    let image = decode_image(path)?;
    let mut edge = API_EDGE;
    let mut quality = 80u8;
    loop {
        let resized = fit(&image, edge);
        let rgb = resized.to_rgb8();
        let mut data = Vec::new();
        let mut encoder = JpegEncoder::new_with_quality(&mut data, quality);
        encoder
            .encode_image(&DynamicImage::ImageRgb8(rgb))
            .map_err(|error| AppError::new("IMAGE_INVALID", error.to_string()))?;
        if data.len() <= API_MAX_BYTES {
            let encoded = base64::engine::general_purpose::STANDARD.encode(&data);
            return Ok(format!("data:image/jpeg;base64,{encoded}"));
        }
        if quality > 50 {
            quality -= 10;
        } else if edge > 900 {
            edge -= 256;
        } else {
            return Err(AppError::new(
                "IMAGE_INVALID",
                "图片无法压缩到 DeepSeek 请求大小限制内",
            ));
        }
    }
}

pub fn image_data_url(path: &Path) -> AppResult<String> {
    let bytes = fs::read(path)?;
    let mime = match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "image/jpeg",
    };
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::BufReader;

    use image::{ImageBuffer, Rgb};
    use little_exif::exif_tag::ExifTag;
    use little_exif::filetype::FileExtension;
    use little_exif::metadata::Metadata;
    use little_exif::rational::uR64;

    fn make_jpeg(path: &Path) {
        let image: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::from_fn(320, 200, |x, y| {
            Rgb([(x % 255) as u8, (y % 255) as u8, 120])
        });
        let mut bytes = Vec::new();
        let mut encoder = JpegEncoder::new_with_quality(&mut bytes, 90);
        encoder
            .encode_image(&DynamicImage::ImageRgb8(image))
            .unwrap();
        let mut metadata = Metadata::new();
        metadata.set_tag(ExifTag::DateTimeOriginal("2026:11:08 23:30:00".to_string()));
        metadata.set_tag(ExifTag::OffsetTimeOriginal("+08:00".to_string()));
        metadata.set_tag(ExifTag::LensMake("Test Optics".to_string()));
        metadata.set_tag(ExifTag::LensModel("Test 50mm".to_string()));
        metadata.set_tag(ExifTag::FNumber(vec![uR64 {
            nominator: 28,
            denominator: 10,
        }]));
        metadata.set_tag(ExifTag::ExposureTime(vec![uR64 {
            nominator: 1,
            denominator: 125,
        }]));
        metadata.set_tag(ExifTag::ISO(vec![200]));
        metadata.set_tag(ExifTag::Orientation(vec![6]));
        metadata.set_tag(ExifTag::Make("Secret Camera Co".to_string()));
        metadata.set_tag(ExifTag::Model("Secret Model".to_string()));
        metadata.set_tag(ExifTag::SerialNumber("SN123456".to_string()));
        metadata.set_tag(ExifTag::Software("Secret Editor".to_string()));
        metadata
            .write_to_vec(&mut bytes, FileExtension::JPEG)
            .unwrap();
        fs::write(path, bytes).unwrap();
    }

    #[test]
    fn rejects_oversized_files_before_decoding() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("huge.jpg");
        let file = fs::File::create(&path).unwrap();
        file.set_len(MAX_UPLOAD_BYTES + 1).unwrap();
        let error = decode_image(&path).unwrap_err();
        assert_eq!(error.code, "IMAGE_TOO_LARGE");
    }

    #[test]
    fn applies_all_eight_exif_orientations() {
        let image: ImageBuffer<Rgb<u8>, Vec<u8>> =
            ImageBuffer::from_fn(2, 3, |x, y| Rgb([(x * 80) as u8, (y * 60) as u8, 20]));
        for orientation in 1..=8 {
            let result = apply_orientation(DynamicImage::ImageRgb8(image.clone()), orientation);
            let (width, height) = result.dimensions();
            if orientation <= 4 {
                assert_eq!((width, height), (2, 3), "orientation {orientation}");
            } else {
                assert_eq!((width, height), (3, 2), "orientation {orientation}");
            }
        }
    }

    #[test]
    fn extracts_dates_and_whitelist_fields() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.jpg");
        make_jpeg(&source);
        let exif = crate::exif_meta::read_photo_exif(&source).unwrap();
        assert_eq!(exif.date.as_deref(), Some("2026-11-08"));
        assert_eq!(
            exif.captured_at.as_deref(),
            Some("2026-11-08T23:30:00+08:00")
        );
        assert_eq!(exif.orientation, 6);
        assert_eq!(exif.whitelist.lens_model.as_deref(), Some("Test 50mm"));
        assert_eq!(exif.whitelist.f_number, Some((28, 10)));
        assert_eq!(exif.whitelist.exposure_time, Some((1, 125)));
        assert_eq!(exif.whitelist.iso, Some(vec![200]));
    }

    #[test]
    fn outputs_resized_webp_with_only_whitelist_exif() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.jpg");
        make_jpeg(&source);
        let exif = crate::exif_meta::read_photo_exif(&source).unwrap();
        let root = dir.path().join("site");
        fs::create_dir_all(&root).unwrap();
        let processed = process_photo(&source, &root, "2026-11-08", &exif).unwrap();
        let photo_path = root.join(&processed.photo);
        let thumb_path = root.join(&processed.thumbnail);
        assert!(photo_path.is_file());
        assert!(thumb_path.is_file());

        let photo = image::open(&photo_path).unwrap();
        assert!(photo.width() <= FULL_EDGE && photo.height() <= FULL_EDGE);
        let thumb = image::open(&thumb_path).unwrap();
        assert!(thumb.width() <= THUMB_EDGE && thumb.height() <= THUMB_EDGE);

        let file = fs::File::open(&photo_path).unwrap();
        let mut reader = BufReader::new(file);
        let metadata = exif::Reader::new()
            .read_from_container(&mut reader)
            .unwrap();
        assert!(metadata
            .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
            .is_some());
        assert!(metadata
            .get_field(exif::Tag::LensModel, exif::In::PRIMARY)
            .is_some());
        assert!(metadata
            .get_field(exif::Tag::FNumber, exif::In::PRIMARY)
            .is_some());
        assert!(metadata
            .get_field(exif::Tag::ExposureTime, exif::In::PRIMARY)
            .is_some());
        assert!(metadata
            .get_field(exif::Tag::PhotographicSensitivity, exif::In::PRIMARY)
            .is_some());
        for forbidden in [
            exif::Tag::Make,
            exif::Tag::Model,
            exif::Tag::BodySerialNumber,
            exif::Tag::Software,
            exif::Tag::Orientation,
        ] {
            assert!(
                metadata.get_field(forbidden, exif::In::PRIMARY).is_none(),
                "forbidden tag present: {forbidden:?}"
            );
        }

        let file = fs::File::open(&thumb_path).unwrap();
        let mut reader = BufReader::new(file);
        assert!(matches!(
            exif::Reader::new().read_from_container(&mut reader),
            Err(exif::Error::NotFound(_))
        ));
    }

    #[test]
    fn api_copy_has_no_exif_and_fits_limits() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.jpg");
        make_jpeg(&source);
        let data_url = prepare_api_image(&source).unwrap();
        let encoded = data_url.strip_prefix("data:image/jpeg;base64,").unwrap();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .unwrap();
        assert!(bytes.len() <= API_MAX_BYTES);
        let image = image::load_from_memory(&bytes).unwrap();
        assert!(image.width() <= API_EDGE && image.height() <= API_EDGE);
        let mut cursor = std::io::Cursor::new(bytes);
        assert!(matches!(
            exif::Reader::new().read_from_container(&mut cursor),
            Err(exif::Error::NotFound(_))
        ));
    }
}

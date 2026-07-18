use futures_util::StreamExt;
use std::path::Path;
use tokio::io::AsyncWriteExt;
use tracing::info;

pub async fn download_and_extract_tar_gz(url: &str, dest_dir: &Path) -> anyhow::Result<()> {
    info!("Downloading {}", url);
    let response = reqwest::get(url).await?;
    let mut stream = response.bytes_stream();

    let std_file = tempfile::tempfile()?;
    let tokio_file = tokio::fs::File::from_std(std_file);
    let mut tokio_file = tokio::io::BufWriter::new(tokio_file);

    while let Some(chunk) = stream.next().await {
        tokio_file.write_all(&chunk?).await?;
    }
    tokio_file.flush().await?;

    let mut std_file = tokio_file
        .into_inner()
        .try_into_std()
        .map_err(|_| anyhow::anyhow!("Failed to convert tokio file"))?;

    info!("Extracting to {:?}", dest_dir);
    let dest_dir = dest_dir.to_path_buf();

    tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
        use std::io::{Seek, SeekFrom};
        std_file.seek(SeekFrom::Start(0))?;
        let tar = flate2::read::GzDecoder::new(std_file);
        let mut archive = tar::Archive::new(tar);
        archive.unpack(&dest_dir)?;
        Ok(())
    })
    .await??;

    Ok(())
}

#[cfg(target_os = "windows")]
pub async fn download_and_extract_zip(url: &str, dest_dir: &Path) -> anyhow::Result<()> {
    info!("Downloading {}", url);
    let response = reqwest::get(url).await?;
    let mut stream = response.bytes_stream();

    let std_file = tempfile::tempfile()?;
    let tokio_file = tokio::fs::File::from_std(std_file);
    let mut tokio_file = tokio::io::BufWriter::new(tokio_file);

    while let Some(chunk) = stream.next().await {
        tokio_file.write_all(&chunk?).await?;
    }
    tokio_file.flush().await?;

    let mut std_file = tokio_file
        .into_inner()
        .try_into_std()
        .map_err(|_| anyhow::anyhow!("Failed to convert tokio file"))?;

    info!("Extracting to {:?}", dest_dir);
    let dest_dir = dest_dir.to_path_buf();

    tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
        use std::io::{Seek, SeekFrom};
        std_file.seek(SeekFrom::Start(0))?;
        let mut archive = zip::ZipArchive::new(std_file)?;
        archive.extract(&dest_dir)?;
        Ok(())
    })
    .await??;
    Ok(())
}

pub async fn download_and_extract_gz(url: &str, dest_file: &Path) -> anyhow::Result<()> {
    info!("Downloading {}", url);
    let response = reqwest::get(url).await?;
    let mut stream = response.bytes_stream();

    let std_file = tempfile::tempfile()?;
    let tokio_file = tokio::fs::File::from_std(std_file);
    let mut tokio_file = tokio::io::BufWriter::new(tokio_file);

    while let Some(chunk) = stream.next().await {
        tokio_file.write_all(&chunk?).await?;
    }
    tokio_file.flush().await?;

    let mut std_file = tokio_file
        .into_inner()
        .try_into_std()
        .map_err(|_| anyhow::anyhow!("Failed to convert tokio file"))?;

    info!("Extracting gz to {:?}", dest_file);
    let dest_file = dest_file.to_path_buf();

    tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
        use std::io::{Read, Seek, SeekFrom, Write};
        std_file.seek(SeekFrom::Start(0))?;
        let mut gz = flate2::read::GzDecoder::new(std_file);

        let mut out = std::fs::File::create(&dest_file)?;
        std::io::copy(&mut gz, &mut out)?;

        // Make executable on unix
        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = out.metadata()?.permissions();
            perms.set_mode(0o755);
            out.set_permissions(perms)?;
        }

        Ok(())
    })
    .await??;

    Ok(())
}

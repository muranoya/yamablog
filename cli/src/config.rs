use anyhow::{Context, Result};

pub struct R2Config {
    pub endpoint_url: String,
    pub bucket: String,
    pub(crate) access_key_id: String,
    pub(crate) secret_access_key: String,
}

impl R2Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            endpoint_url: std::env::var("R2_ENDPOINT_URL")
                .context("R2_ENDPOINT_URL not set")?,
            bucket: std::env::var("R2_BUCKET")
                .context("R2_BUCKET not set")?,
            access_key_id: std::env::var("R2_ACCESS_KEY_ID")
                .context("R2_ACCESS_KEY_ID not set")?,
            secret_access_key: std::env::var("R2_SECRET_ACCESS_KEY")
                .context("R2_SECRET_ACCESS_KEY not set")?,
        })
    }
}

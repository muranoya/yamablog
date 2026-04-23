use anyhow::Result;
use aws_config::BehaviorVersion;
use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;
use crate::config::R2Config;

pub struct R2Uploader {
    client: Client,
    bucket: String,
}

impl R2Uploader {
    pub async fn new(cfg: &R2Config) -> Result<Self> {
        let creds = Credentials::new(
            &cfg.access_key_id,
            &cfg.secret_access_key,
            None, None,
            "yamablog",
        );
        let config = aws_config::defaults(BehaviorVersion::latest())
            .region(Region::new("auto"))
            .endpoint_url(&cfg.endpoint_url)
            .credentials_provider(creds)
            .load()
            .await;
        let client = Client::new(&config);
        Ok(Self { client, bucket: cfg.bucket.clone() })
    }

    pub async fn upload_html(&self, key: &str, html: String) -> Result<()> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .content_type("text/html; charset=utf-8")
            .cache_control("no-cache")
            .body(ByteStream::from(html.into_bytes()))
            .send()
            .await?;
        Ok(())
    }

    pub async fn upload_json(&self, key: &str, json: String) -> Result<()> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .content_type("application/json")
            .cache_control("no-cache")
            .body(ByteStream::from(json.into_bytes()))
            .send()
            .await?;
        Ok(())
    }
}

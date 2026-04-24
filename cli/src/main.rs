mod build;
mod config;
mod data;
mod schema;
mod upload;

use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "yamablog", version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Build {
        #[arg(long, default_value = "data")]
        data_dir: PathBuf,

        #[arg(long, default_value = "dist")]
        output_dir: PathBuf,

        #[arg(long)]
        blog_dist: Option<PathBuf>,

        #[arg(long)]
        dry_run: bool,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Build { data_dir, output_dir, blog_dist, dry_run } => {
            let blog_dist = blog_dist.unwrap_or_else(|| {
                data_dir
                    .parent()
                    .unwrap_or(std::path::Path::new("."))
                    .join("blog/dist")
            });
            let r2_config = if !dry_run {
                Some(config::R2Config::from_env()?)
            } else {
                None
            };
            build::run(&data_dir, &output_dir, &blog_dist, dry_run, r2_config).await?;
        }
    }
    Ok(())
}

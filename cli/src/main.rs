mod build;
mod data;
mod schema;

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
        #[arg(long, default_value = "blog.sqlite3")]
        db: PathBuf,

        #[arg(long, default_value = "data/gpx")]
        gpx_dir: PathBuf,

        #[arg(long, default_value = "dist")]
        output_dir: PathBuf,

        #[arg(long)]
        blog_dist: Option<PathBuf>,

        #[arg(long)]
        base_url: Option<String>,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Build {
            db,
            gpx_dir,
            output_dir,
            blog_dist,
            base_url,
        } => {
            let blog_dist = blog_dist.unwrap_or_else(|| PathBuf::from("blog/dist"));
            build::run(&db, &gpx_dir, &output_dir, &blog_dist, base_url.as_deref())?;
        }
    }
    Ok(())
}

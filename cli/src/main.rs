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
        #[arg(long, default_value = "data")]
        data_dir: PathBuf,

        #[arg(long, default_value = "dist")]
        output_dir: PathBuf,

        #[arg(long)]
        blog_dist: Option<PathBuf>,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Build {
            data_dir,
            output_dir,
            blog_dist,
        } => {
            let blog_dist = blog_dist.unwrap_or_else(|| {
                data_dir
                    .parent()
                    .unwrap_or(std::path::Path::new("."))
                    .join("blog/dist")
            });
            build::run(&data_dir, &output_dir, &blog_dist)?;
        }
    }
    Ok(())
}

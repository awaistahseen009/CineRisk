terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Remote state in GCS so the deployment is reproducible from any machine.
  # The bucket itself is created by the bootstrap step (see DEPLOYMENT.md);
  # Terraform cannot create the bucket that holds its own state.
  backend "gcs" {
    bucket = "cinerisk-hackathon-tfstate"
    prefix = "cinerisk/prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# APIs the deployment consumes. cloudbuild is included because the backend
# image is built server side with Cloud Build rather than locally: there is
# no running Docker daemon on the deploying machine, and building in GCP
# also avoids pushing a multi-hundred-MB image over a home uplink.
resource "google_project_service" "required" {
  for_each = toset([
    "run.googleapis.com",
    "aiplatform.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  # Leave the APIs on if this config is destroyed. Disabling a shared API is
  # a much larger blast radius than the resources this config owns.
  disable_on_destroy = false
}

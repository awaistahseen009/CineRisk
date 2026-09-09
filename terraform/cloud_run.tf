# --- Artifact Registry ---------------------------------------------------

resource "google_artifact_registry_repository" "backend" {
  project       = var.project_id
  location      = var.region
  repository_id = "cinerisk"
  format        = "DOCKER"
  description   = "CineRisk backend container images."

  depends_on = [google_project_service.required]
}

# --- Runtime identity ----------------------------------------------------

resource "google_service_account" "backend_runtime" {
  project      = var.project_id
  account_id   = "cinerisk-backend"
  display_name = "CineRisk Cloud Run backend runtime"
}

# Every specialist node calls Vertex AI at runtime, so the service identity
# needs aiplatform.user. Secret access is granted per secret in secrets.tf.
resource "google_project_iam_member" "backend_aiplatform" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.backend_runtime.email}"
}

# --- Cloud Run service ---------------------------------------------------

resource "google_cloud_run_v2_service" "backend" {
  project  = var.project_id
  name     = "cinerisk-backend"
  location = var.region

  # Default networking: no VPC connector, no custom subnet.
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.backend_runtime.email

    scaling {
      # NOTE ON min_instance_count = 1.
      #
      # POST /api/runs returns 202 immediately and executes the audit as a
      # FastAPI BackgroundTask. On Cloud Run that is only safe when the
      # container keeps CPU after the response is sent. With the default
      # (scale to zero, CPU throttled outside a request) an audit run would
      # be frozen or killed the moment the 202 was returned, so runs would
      # silently never finish in production even though they work locally.
      #
      # cpu_idle = false below keeps CPU allocated, and a warm instance
      # keeps it from being reclaimed mid-run. This costs one always-on
      # instance, which is the price of the current background-task design.
      min_instance_count = 1
      max_instance_count = 5
    }

    # An audit request itself returns in well under a second, but generous
    # headroom costs nothing and covers a slow cold start.
    timeout = "600s"

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.backend.repository_id}/backend:${var.image_tag}"

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
        # CPU always allocated: required for the background audit runs to
        # make progress after the HTTP response has been returned.
        cpu_idle = false
      }

      ports {
        container_port = 8080
      }

      # Non-secret configuration.
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = var.google_cloud_location
      }
      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }
      env {
        name  = "ENVIRONMENT"
        value = "production"
      }
      env {
        name  = "CORS_ORIGINS"
        value = var.cors_origins
      }
      env {
        name  = "UPSTASH_REDIS_REST_URL"
        value = var.upstash_redis_rest_url
      }

      # Secrets, mounted as env vars from Secret Manager rather than baked
      # into the image or passed as plaintext.
      env {
        name = "PARALLEL_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["parallel-api-key"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["database-url"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "UPSTASH_REDIS_REST_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["upstash-redis-rest-token"].secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.runtime_access,
  ]
}

# Public API: the browser calls this directly from the Vercel frontend, so
# it cannot require an IAM token.
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

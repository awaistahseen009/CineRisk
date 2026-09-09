# Secret Manager entries for the three credentials the backend needs at
# runtime. Values arrive as sensitive Terraform variables from a gitignored
# terraform.tfvars; they are never written into a .tf file.

locals {
  secrets = {
    parallel-api-key         = var.parallel_api_key
    database-url             = var.database_url
    upstash-redis-rest-token = var.upstash_redis_rest_token
  }
}

resource "google_secret_manager_secret" "app" {
  for_each = local.secrets

  project   = var.project_id
  secret_id = each.key

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "app" {
  for_each = local.secrets

  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = each.value
}

# Least privilege: the Cloud Run runtime identity can read these three
# secrets specifically, rather than every secret in the project. This is a
# tighter grant than a project-level roles/secretmanager.secretAccessor
# binding while satisfying the same requirement.
resource "google_secret_manager_secret_iam_member" "runtime_access" {
  for_each = local.secrets

  project   = var.project_id
  secret_id = google_secret_manager_secret.app[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_runtime.email}"
}

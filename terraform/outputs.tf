output "backend_url" {
  description = "Public HTTPS URL of the Cloud Run backend service."
  value       = google_cloud_run_v2_service.backend.uri
}

output "backend_service_account" {
  description = "Runtime identity the Cloud Run service executes as."
  value       = google_service_account.backend_runtime.email
}

output "artifact_registry_image" {
  description = "Fully qualified image path the Cloud Run service deploys."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.backend.repository_id}/backend"
}

output "agent_staging_bucket" {
  description = "GCS bucket used to stage the Agent Engine deployment bundle."
  value       = "gs://${google_storage_bucket.agent_staging.name}"
}

output "secret_ids" {
  description = "Secret Manager secrets created for the backend."
  value       = [for s in google_secret_manager_secret.app : s.secret_id]
}

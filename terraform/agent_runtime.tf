# Staging bucket for the Gemini Enterprise Agent Runtime deployment.
#
# agent_engines / reasoning_engines packages the compiled LangGraph graph
# plus its dependencies and uploads that bundle to GCS before Vertex builds
# the remote engine. The deployment is executed with the Vertex AI Python
# SDK rather than Terraform, because Terraform has no resource type for a
# reasoning engine; Terraform owns the bucket and the IAM that deployment
# depends on, which is the part that benefits from being declarative.

resource "google_storage_bucket" "agent_staging" {
  project  = var.project_id
  name     = "${var.project_id}-agent-staging"
  location = var.region

  uniform_bucket_level_access = true
  force_destroy               = true

  depends_on = [google_project_service.required]
}

# The local ADC principal runs `python -m app.agents.deploy`, so it is the
# identity that writes the packaged agent into the staging bucket.
resource "google_storage_bucket_iam_member" "deployer_staging" {
  bucket = google_storage_bucket.agent_staging.name
  role   = "roles/storage.objectAdmin"
  member = var.deployer_principal
}

# Agent Engine runs as the Vertex AI Reasoning Engine service agent, and the
# deploying principal must be able to act as a service account for the
# create call to be accepted.
resource "google_project_iam_member" "deployer_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = var.deployer_principal
}

# The deployed engine reads the same secrets the Cloud Run service does if
# it is ever pointed at the full pipeline, and calls Vertex AI itself.
resource "google_project_iam_member" "deployer_aiplatform" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = var.deployer_principal
}

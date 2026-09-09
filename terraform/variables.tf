variable "project_id" {
  description = "Target GCP project."
  type        = string
  default     = "cinerisk-hackathon"
}

variable "region" {
  description = "Region for Cloud Run, Artifact Registry, and the buckets."
  type        = string
  default     = "us-central1"
}

# --- Application configuration (non-secret) ------------------------------

variable "gemini_model" {
  description = "Vertex AI model used by every agent node."
  type        = string
  default     = "gemini-2.5-flash"
}

variable "google_cloud_location" {
  description = <<-EOT
    Vertex AI location handed to ChatVertexAI. "global" routes to
    aiplatform.googleapis.com rather than a single region's endpoint;
    regional endpoints carry a much tighter per-region Gemini quota and were
    the direct cause of 429 RESOURCE_EXHAUSTED specialist failures. This is
    deliberately NOT the same value as var.region, which governs where the
    infrastructure lives.
  EOT
  type        = string
  default     = "global"
}

variable "cors_origins" {
  description = <<-EOT
    Comma-separated origins the API accepts browser requests from. The
    Vercel URL is not known until the frontend is first deployed, so this
    starts as localhost and is updated on a second apply.
  EOT
  type        = string
  default     = "http://localhost:3000"
}

variable "image_tag" {
  description = "Tag of the backend image in Artifact Registry to deploy."
  type        = string
  default     = "latest"
}

variable "upstash_redis_rest_url" {
  description = <<-EOT
    Upstash REST endpoint. Passed as a plain environment variable rather
    than a secret: it is a hostname, and it is useless without the token,
    which IS stored in Secret Manager.
  EOT
  type        = string
}

# --- Secrets -------------------------------------------------------------
# Values are supplied through terraform.tfvars, which is gitignored. Nothing
# here carries a default, so a missing value fails the plan loudly rather
# than deploying a service wired to an empty credential.

variable "parallel_api_key" {
  description = "Parallel API key used for all Search API and Task API calls."
  type        = string
  sensitive   = true
}

variable "database_url" {
  description = "Neon Postgres connection string (SQLModel/psycopg form)."
  type        = string
  sensitive   = true
}

variable "upstash_redis_rest_token" {
  description = "Upstash Redis REST token."
  type        = string
  sensitive   = true
}

# --- Agent Engine --------------------------------------------------------

variable "deployer_principal" {
  description = <<-EOT
    The IAM principal that executes the Agent Engine deployment from the
    Vertex AI SDK (local ADC), in "user:name@example.com" form. It needs
    write access to the staging bucket.
  EOT
  type        = string
}

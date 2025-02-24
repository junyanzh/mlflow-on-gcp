# MLflow Deployment on Google Cloud Platform

This repository contains Infrastructure as Code (IaC) using Pulumi for deploying MLflow on Google Cloud Platform (GCP). The deployment leverages several GCP services including Cloud SQL, Cloud Storage, Secret Manager, and Artifact Registry.

## Architecture Overview

The deployment consists of:
- PostgreSQL database on Cloud SQL for metadata storage
- Cloud Storage bucket for artifacts storage
- Secret Manager for storing sensitive configurations
- Artifact Registry for Docker images
- VM instance running MLflow server with cloud-sql-proxy

## Prerequisites

- Google Cloud Platform account with billing enabled
- Google Cloud SDK installed
- Pulumi CLI installed
- Node.js installed
- Docker installed
- Python 3.9 or later (optional, for running experiments)

## Infrastructure Components

The Pulumi script (`index.ts`) creates the following resources:
- Cloud SQL PostgreSQL instance
- Cloud Storage bucket for MLflow artifacts
- Service accounts and IAM roles
- Secret Manager secrets
- Artifact Registry repository

## Deployment

1. Clone this repository
```bash
git clone <repository-url>
cd <repository-name>
```
2. Install dependencies

```bash
npm install
```

3. Configure Pulumi and GCP

```bash
pulumi config set gcp:project <your-project-id>
pulumi config set gcp:region asia-east1
```

4. Deploy the infrastructure

```bash
pulumi up
```

5. Deploy MLflow using Docker Compose

```bash
# Create credentials.json file with service account key
# Deploy using docker-compose
docker-compose up -d
```

## Environment Variables

### MLflow server configuration

```plaintext
MLFLOW_TRACKING_USERNAME=admin
MLFLOW_TRACKING_PASSWORD=<generated-password>
```

### Docker Compose Configuration

The `docker-compose.yml` file sets up:

- **cloud-sql-proxy** for database connection
- **MLflow server** with PostgreSQL backend and GCS artifact store

### Accessing MLflow UI

Once deployed, MLflow UI is accessible at:

```plaintext
http://<vm-external-ip>:5000
```

## Clean Up

To destroy all created resources:

```bash
pulumi destroy
```

### Important Notes

- The Cloud SQL instance (db-f1-micro) costs approximately $25-30 per month.
- Cloud Storage costs depend on usage ($0.03 per GB per month).
- Consider reviewing and adjusting the security settings for production use.

## References

- [MLflow Documentation](https://www.mlflow.org/docs/latest/index.html)
- [Pulumi GCP Documentation](https://www.pulumi.com/docs/intro/cloud-providers/gcp/)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)

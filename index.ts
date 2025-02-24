import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as docker from "@pulumi/docker";
import * as random from "@pulumi/random";

// Provider configuration
const gcpConfig = new pulumi.Config("gcp");
const project = gcpConfig.require("project");
const location = gcpConfig.require("region");

// Enable service APIs
const apis = [
  "compute",
  "artifactregistry",
  "run",
  "sqladmin",
  "secretmanager",
];
for (const api of apis) {
  new gcp.projects.Service(`${api} API`, {
    service: `${api}.googleapis.com`,
    disableDependentServices: true,
    disableOnDestroy: false,
  });
}

// Artifact Registry repository for container images
const repo = new gcp.artifactregistry.Repository("repository", {
  repositoryId: "images",
  format: "DOCKER",
});
const repoUrl = pulumi.interpolate`${repo.location}-docker.pkg.dev/${repo.project}/${repo.repositoryId}`;

// MLflow container image
const image = new docker.Image("mlflow", {
  imageName: pulumi.interpolate`${repoUrl}/mlflow`,
  build: {
    context: "docker/mlflow",
    platform: "linux/amd64",
  },
});
export const imageDigest = image.repoDigest;

// Storage Bucket for artifacts
const bucketSuffix = new random.RandomId("artifact bucket suffix", {
  byteLength: 4,
});
const artifactBucket = new gcp.storage.Bucket("artifacts", {
  name: pulumi.concat("mlflow-artifacts-", bucketSuffix.hex),
  location: "ASIA",
  uniformBucketLevelAccess: true,
  publicAccessPrevention: "enforced",
});
export const bucket = artifactBucket.name;

// Cloud SQL instance for tracking backend storage and authentication data
const instance = new gcp.sql.DatabaseInstance("mlflow", {
  databaseVersion: "POSTGRES_15",
  deletionProtection: false,
  settings: {
    tier: "db-f1-micro",
    availabilityType: "ZONAL",
    activationPolicy: "ALWAYS",
  },
});

const trackingDb = new gcp.sql.Database("tracking", {
  instance: instance.name,
  name: "mlflow",
});

const authDb = new gcp.sql.Database("auth", {
  instance: instance.name,
  name: "mlflow-auth",
});

const dbPassword = new random.RandomPassword("mlflow", {
  length: 16,
  special: false,
});
const user = new gcp.sql.User("mlflow", {
  instance: instance.name,
  name: "mlflow",
  password: dbPassword.result,
});

export const trackingDbInstanceUrl = pulumi.interpolate`postgresql://${user.name}:${user.password}@/${trackingDb.name}?host=/cloudsql/${instance.connectionName}`;
export const authDbInstanceUrl = pulumi.interpolate`postgresql://${user.name}:${user.password}@/${authDb.name}?host=/cloudsql/${instance.connectionName}`;

// Secret Manager
const authSecret = new gcp.secretmanager.Secret("mlflow-basic-auth-conf", {
  secretId: "basic_auth-ini",
  replication: { auto: {} },
});

const adminPw = new random.RandomPassword("mlflow-admin", {
  length: 16,
  special: false,
});
export const adminUsername = "admin";
export const adminPassword = adminPw.result.apply((pw) => pw);

const authSecretVersion = new gcp.secretmanager.SecretVersion(
  "mlflow-auth-conf",
  {
    secret: authSecret.id,
    secretData: pulumi.interpolate`[mlflow]
default_permission = READ
database_uri = ${authDbInstanceUrl}
admin_username = ${adminUsername}
admin_password=${adminPassword}
authorization_function = mlflow.server.auth:authenticate_request_basic_auth
`,
  }
);

// Service Account and IAM role bindings
const sa = new gcp.serviceaccount.Account("mlflow", {
  accountId: "mlflow",
});
const roles = ["roles/cloudsql.client", "roles/secretmanager.secretAccessor"];
for (const role of roles) {
  new gcp.projects.IAMMember(role, {
    project: project,
    role,
    member: pulumi.concat("serviceAccount:", sa.email),
  });
}

const iam = new gcp.storage.BucketIAMMember("artifacts access", {
  bucket: bucket,
  member: pulumi.concat("serviceAccount:", sa.email),
  role: "roles/storage.objectUser",
});

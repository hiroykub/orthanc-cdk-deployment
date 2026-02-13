// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Duration, PhysicalName, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { InstanceClass, InstanceSize, InstanceType, SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { AccessPoint, FileSystem, LifecyclePolicy, PerformanceMode, ThroughputMode } from "aws-cdk-lib/aws-efs";
import { Key } from "aws-cdk-lib/aws-kms";
import {
  AuroraPostgresEngineVersion,
  ClusterInstance,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
  ServerlessV2ClusterInstanceProps,
} from "aws-cdk-lib/aws-rds";
import { BlockPublicAccess, Bucket, BucketEncryption, StorageClass } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export class StorageStack extends Stack {

  readonly rdsSecret: Secret;
  readonly fileSystem?: FileSystem;
  readonly dbCluster: DatabaseCluster;
  readonly dbEndpointAddress: string;
  readonly dbEndpointPort: string;
  readonly orthancBucket?: Bucket;
  readonly efsAccessPoint?: AccessPoint;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);
      // ********************************
      // DB Credentials (Secrets Manager)
      // ********************************
      this.rdsSecret = new Secret(this, 'Orthanc-RDSDatabaseSecret',{
        generateSecretString: {
          excludeCharacters: "\'\"@/\\",
          passwordLength: 16
        }});

      if(props.enable_dicom_s3_storage) {
        // ********************************
        // S3 DICOM Image store bucket definition
        // ********************************   
        const bucketKmsKey = new Key(this, 'OrthancBucketKey', {
          enableKeyRotation: true
        });
    
        this.orthancBucket = new Bucket(this, 'OrthancBucket', {
            bucketName: PhysicalName.GENERATE_IF_NEEDED,
            encryption: BucketEncryption.KMS,
            encryptionKey: bucketKmsKey,
            blockPublicAccess:BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            versioned: true,
            lifecycleRules: [
              {
                abortIncompleteMultipartUploadAfter: Duration.days(30),
                transitions: [
                  {
                    storageClass: StorageClass.INTELLIGENT_TIERING,
                    transitionAfter: Duration.days(30)
                  },
                ],
              },
            ],
        });
        //TODO: add bucket policy
      }
      else { // If S3 is disabled, fall back to standard EFS storage
        // ********************************
        // EFS FileSystem configuration
        // ********************************
        const efsKmsKey = new Key(this, 'OrthancEFSKey', {
          enableKeyRotation: true
        });

        this.fileSystem = new FileSystem(this, 'OrthancFileSystem', {
          vpc: props.vpc,
          securityGroup: props.efsSecurityGroup,
          lifecyclePolicy: LifecyclePolicy.AFTER_14_DAYS,
          performanceMode: PerformanceMode.GENERAL_PURPOSE,
          throughputMode: ThroughputMode.BURSTING,
          encrypted: true,
          removalPolicy: RemovalPolicy.DESTROY,
          kmsKey: efsKmsKey
        });

        this.efsAccessPoint = this.fileSystem.addAccessPoint('NFSAccessPoint',{
            createAcl: {
              ownerGid: "433",
              ownerUid: "431",
              permissions: "755"
            },
            posixUser: {
                gid: "433",
                uid: "431"
            },
            path: "/orthanc" 
        });
      }

      // ********************************
      // Aurora Serverless v2 configuration
      // ********************************   
      const rdsKmsKey = new Key(this, 'OrthancRDSKey', {
        enableKeyRotation: true
      });
      
      this.dbCluster = new DatabaseCluster(this, 'orthanc-aurora-cluster', {
        engine: DatabaseClusterEngine.auroraPostgres({
          version: AuroraPostgresEngineVersion.VER_16_6,
        }),
        serverlessV2MinCapacity: 0.5,
        serverlessV2MaxCapacity: 4,
        writer: ClusterInstance.serverlessV2('writer', {
          publiclyAccessible: false,
        }),
        defaultDatabaseName: "OrthancDB",
        storageEncrypted: true,
        storageEncryptionKey: rdsKmsKey,
        deletionProtection: false,
        backup: {
          retention: props.enable_rds_backup ? Duration.days(30) : Duration.days(1),
        },
        credentials: Credentials.fromPassword("postgres", this.rdsSecret.secretValue),
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [props.dbClusterSecurityGroup],
        removalPolicy: RemovalPolicy.DESTROY,
      });

      this.dbEndpointAddress = this.dbCluster.clusterEndpoint.hostname;
      this.dbEndpointPort = this.dbCluster.clusterEndpoint.port.toString();
  };
}

interface StorageStackProps extends StackProps {
  vpc: Vpc;
  dbClusterSecurityGroup: SecurityGroup;
  efsSecurityGroup: SecurityGroup;
  enable_dicom_s3_storage: boolean;
  enable_multi_az: boolean;
  enable_rds_backup: boolean;
}

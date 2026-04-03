import os
import uuid
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()


class S3Service:
    def __init__(self):
        self.client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION"),
        )
        self.bucket = os.getenv("S3_BUCKET_NAME")
        self.region = os.getenv("AWS_REGION")

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str) -> dict:
        s3_key = f"uploads/{uuid.uuid4()}_{filename}"
        self.client.put_object(
            Bucket=self.bucket,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
        )
        s3_url = f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{s3_key}"
        return {"s3_key": s3_key, "s3_url": s3_url}

    def delete_file(self, s3_key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=s3_key)
            return True
        except ClientError:
            return False

    def get_file_bytes(self, s3_key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=s3_key)
        return response["Body"].read()

    def put_file_bytes(self, s3_key: str, file_bytes: bytes, content_type: str = "text/plain") -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
        )

# Rekognition setup (guest face search)

Lookit indexes event photo faces with AWS Rekognition and searches by guest selfie.

## IAM (same AWS keys as S3 media)

IAM user `yashchauhan08` currently has S3 access but **not** Rekognition. Attach this inline policy (region `ap-south-1`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:CreateCollection",
        "rekognition:DescribeCollection",
        "rekognition:IndexFaces",
        "rekognition:SearchFacesByImage",
        "rekognition:DeleteFaces",
        "rekognition:DeleteCollection",
        "rekognition:ListFaces"
      ],
      "Resource": "*"
    }
  ]
}
```

Then re-run: `npx tsx src/scripts/reindex-faces.ts`

## Env

```
FACE_ENGINE=rekognition
FACE_MATCH_THRESHOLD=90
DAILY_FACE_CALL_CAP=5000
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

## Workers

```bash
npm run dev          # API
npm run dev:worker   # process-photo + index-faces
```

## Re-index processed photos

```bash
npx tsx src/scripts/reindex-faces.ts
```

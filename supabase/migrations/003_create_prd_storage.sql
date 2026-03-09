-- Create storage bucket for PRD uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('prd-uploads', 'prd-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for authenticated users to upload their own files
CREATE POLICY "Users can upload their own PRD files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prd-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create storage policy for users to read their own files
CREATE POLICY "Users can read their own PRD files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prd-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create storage policy for users to delete their own files
CREATE POLICY "Users can delete their own PRD files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'prd-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

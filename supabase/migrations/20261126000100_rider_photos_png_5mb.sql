-- sms-glass accepts JPEG and PNG photos up to 5 MB (Twilio's MMS limit), but the bucket only
-- took JPEG up to 2 MB, so larger or PNG photos were silently dropped.
update storage.buckets
set file_size_limit = 5000000, allowed_mime_types = array['image/jpeg', 'image/png']
where id = 'rider-photos';

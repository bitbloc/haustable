-- Create a new storage bucket for stock images
insert into storage.buckets (id, name, public)
values ('stock-images', 'stock-images', true)
on conflict (id) do nothing;

-- Policy: Give public access to view images
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'stock-images' );

-- Policy: Allow authenticated users (staff) to upload images
create policy "Authenticated Upload"
  on storage.objects for insert
  with check ( bucket_id = 'stock-images' and auth.role() = 'authenticated' );

-- Policy: Allow users to update their own uploads (or all staff)
create policy "Staff Update"
  on storage.objects for update
  using ( bucket_id = 'stock-images' and auth.role() = 'authenticated' );

-- Policy: Allow users to delete
create policy "Staff Delete"
  on storage.objects for delete
  using ( bucket_id = 'stock-images' and auth.role() = 'authenticated' );

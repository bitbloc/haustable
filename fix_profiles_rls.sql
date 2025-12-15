-- Allow users to insert their own profile
create policy "Users can insert their own profile"
on profiles for insert
with check ( auth.uid() = id );

-- Allow users to update their own profile
create policy "Users can update their own profile"
on profiles for update
using ( auth.uid() = id );

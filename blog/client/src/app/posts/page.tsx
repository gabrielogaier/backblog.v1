export { revalidate, generateMetadata } from "@/features/pages/public/PostsArchivePage";
import PostsArchivePage from "@/features/pages/public/PostsArchivePage";

type PostsArchivePageProps = Parameters<typeof PostsArchivePage>[0];

export default function PostsArchiveRoute(props: PostsArchivePageProps) {
  return <PostsArchivePage {...props} />;
}

export { revalidate, generateMetadata } from "@/features/pages/public/PostsMonthlyArchivePage";
import PostsMonthlyArchivePage from "@/features/pages/public/PostsMonthlyArchivePage";

type PostsMonthlyArchivePageProps = Parameters<typeof PostsMonthlyArchivePage>[0];

export default function PostsMonthlyArchiveRoute(props: PostsMonthlyArchivePageProps) {
  return <PostsMonthlyArchivePage {...props} />;
}

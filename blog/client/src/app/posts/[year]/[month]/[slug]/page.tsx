export { revalidate, generateMetadata } from "@/features/pages/public/PostDetailsPage";
import PostDetailsPage from "@/features/pages/public/PostDetailsPage";

type PostDetailsPageProps = Parameters<typeof PostDetailsPage>[0];

export default function PostDetailsRoute(props: PostDetailsPageProps) {
  return <PostDetailsPage {...props} />;
}

import { currentUser, AppError } from "@/server/access";
import { analytics } from "@/server/analytics";
export async function GET(request: Request) {
  try {
    return Response.json(
      await analytics(await currentUser(), new URL(request.url).searchParams),
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Report unavailable. Please retry.",
      },
      { status: e instanceof AppError ? e.status : 500 },
    );
  }
}

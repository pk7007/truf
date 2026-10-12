import { z } from "zod";
import { currentUser, sameOrigin, AppError } from "@/server/access";
import { interpretSearch } from "@/server/search";
import { limit } from "@/server/rate-limit";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    await limit(user.id, "search", 10);
    const { query } = z
      .object({ query: z.string().min(2).max(500) })
      .parse(await request.json());
    return Response.json(await interpretSearch(query));
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Search could not be interpreted. Use normal filters.",
      },
      { status: e instanceof AppError ? e.status : 400 },
    );
  }
}

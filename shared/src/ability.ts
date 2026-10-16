import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";
import type { MessageVisibility, Role } from "./domain.js";

export type Action = "manage" | "create" | "read" | "update";

export interface BookRecord {
  authorPublicId: string;
}

export interface TicketRecord {
  authorPublicId: string;
}

export interface ReplyRecord {
  authorPublicId: string;
  visibility: MessageVisibility;
}

export type SubjectName = "Book" | "Ticket" | "Reply" | "InternalNote" | "AdminArea" | "all";

type AppSubjects =
  | SubjectName
  | BookRecord
  | TicketRecord
  | ReplyRecord;

export type AppAbility = MongoAbility<[Action, AppSubjects]>;

export interface AbilityActor {
  role: Role;
  authorPublicId: string | null;
}

/**
 * Role capabilities live here so the UI and the API share one definition.
 * Ownership conditions are part of the rule. Services also scope every query
 * to the authenticated author. Frontend checks are not authoritative.
 */
export function defineAbilityFor(user: AbilityActor): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (user.role === "ADMIN") {
    can("manage", "all");
    return build();
  }

  const authorPublicId = user.authorPublicId ?? "__none__";
  can("read", "Book", { authorPublicId });
  can("read", "Ticket", { authorPublicId });
  can("create", "Ticket");
  can("read", "Reply", { authorPublicId, visibility: "AUTHOR_VISIBLE" });

  return build();
}

CREATE TABLE "bareme" (
	"work_id" text PRIMARY KEY NOT NULL,
	"unite" text NOT NULL,
	"prix_unitaire" real NOT NULL,
	"cee" real NOT NULL,
	"mpr_tres_modeste" real NOT NULL,
	"mpr_modeste" real NOT NULL,
	"mpr_intermediaire" real NOT NULL,
	"mpr_superieur" real NOT NULL,
	"plafond_unites" integer
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"params" jsonb NOT NULL,
	"works" jsonb NOT NULL,
	"tranche" text NOT NULL,
	"surfaces" jsonb NOT NULL,
	"estimation" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

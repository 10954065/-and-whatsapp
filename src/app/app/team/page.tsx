import type { Metadata } from "next";
import { MailPlus } from "lucide-react";
import { AccessDenied, PageHeader } from "@/components/app/page-primitives";
import { InviteMemberForm, RemoveMemberButton, RevokeInvitationButton, RoleSelect } from "@/components/team/team-forms";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS, assignableRoles } from "@/config/permissions";
import { formatDate } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { listTeam } from "@/modules/team/team.service";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const context = await requireTenant();
  if (!context.can("team.read")) return <AccessDenied what="team members" />;
  const { members, invitations } = await listTeam(context.businessId);
  const canManage = context.can("team.manage");
  const manageable = assignableRoles(context.role);
  const roleOptions = manageable.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

  return (
    <>
      <PageHeader title="Team" description="Everyone with access to this workspace and what they can do." />
      {canManage ? (
        <section className="mb-6 rounded-2xl border bg-card p-6">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <MailPlus className="size-4 text-primary" aria-hidden="true" /> Invite a teammate
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">They&apos;ll get an email link that expires in 7 days.</p>
          {context.user.emailVerifiedAt ? (
            <InviteMemberForm roles={roleOptions} />
          ) : (
            <p className="text-sm text-warning">Confirm your email address before inviting your team.</p>
          )}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.userId === context.user.id;
              const isManageable = canManage && !isSelf && manageable.includes(member.role);
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <p className="font-medium">
                      {member.user.name} {isSelf ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  </TableCell>
                  <TableCell>
                    {isManageable ? (
                      <RoleSelect membershipId={member.id} role={member.role} roles={roleOptions} />
                    ) : (
                      <Badge variant={member.role === "OWNER" ? "default" : "secondary"}>{ROLE_LABELS[member.role]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {formatDate(member.createdAt, context.business.timezone)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isManageable ? <RemoveMemberButton membershipId={member.id} name={member.user.name} /> : null}
                  </TableCell>
                </TableRow>
              );
            })}
            {invitations.map((invitation) => (
              <TableRow key={invitation.id} className="bg-muted/30">
                <TableCell>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">Invitation pending</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ROLE_LABELS[invitation.role]}</Badge>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  Expires {formatDate(invitation.expiresAt, context.business.timezone)}
                </TableCell>
                <TableCell className="text-right">{canManage ? <RevokeInvitationButton invitationId={invitation.id} /> : null}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}

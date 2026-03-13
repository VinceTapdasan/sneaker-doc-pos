import { Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, and } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import { AuditService } from '../audit/audit.service';
import { users, staffDocuments, branches } from '../db/schema';
import type { UserType } from '../db/constants';
import type { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditService,
  ) {}

  async findOrCreate(id: string, email: string) {
    const [existing] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, id));
    if (existing) return existing;

    const [created] = await this.drizzle.db
      .insert(users)
      .values({ id, email, userType: 'staff' })
      .returning();
    return created;
  }

  async findById(id: string) {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user ?? null;
  }

  async onboard(id: string, branchId: number) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    // Verify the branch exists and is active
    const [branch] = await this.drizzle.db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.isActive, true)));
    if (!branch) throw new NotFoundException('Branch not found or inactive');

    const [updated] = await this.drizzle.db
      .update(users)
      .set({ branchId })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async getBranchId(userId: string): Promise<number | null> {
    const user = await this.findById(userId);
    return user?.branchId ?? null;
  }

  async findAll(branchId?: number) {
    const whereClause = branchId
      ? and(eq(users.isActive, true), eq(users.branchId, branchId))
      : eq(users.isActive, true);
    return this.drizzle.db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(asc(users.createdAt));
  }

  // Returns active users for transaction assignment dropdowns
  // Filtered to the same branch if branchId is provided
  async findAssignable(branchId?: number | null) {
    const baseCondition = eq(users.isActive, true);
    const whereClause = branchId
      ? and(baseCondition, eq(users.branchId, branchId))
      : baseCondition;
    return this.drizzle.db
      .select({
        id: users.id,
        nickname: users.nickname,
        fullName: users.fullName,
        email: users.email,
        userType: users.userType,
        branchId: users.branchId,
      })
      .from(users)
      .where(whereClause)
      .orderBy(asc(users.nickname));
  }

  async remove(id: string, performedBy?: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    await this.drizzle.db
      .update(users)
      .set({ isActive: false })
      .where(and(eq(users.id, id), eq(users.isActive, true)));

    await this.audit.log({
      action: `Deactivated user: ${user.email}`,
      entityType: 'user',
      entityId: id,
      source: 'admin',
      performedBy,
      branchId: user.branchId ?? undefined,
      details: { email: user.email },
    });
  }

  async updateUserType(id: string, userType: UserType, performedBy?: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const [updated] = await this.drizzle.db
      .update(users)
      .set({ userType })
      .where(eq(users.id, id))
      .returning();

    await this.audit.log({
      action: `Updated user role: ${user.email} → ${userType}`,
      entityType: 'user',
      entityId: id,
      source: 'admin',
      performedBy,
      branchId: user.branchId ?? undefined,
      details: { email: user.email, prevRole: user.userType, newRole: userType },
    });

    return updated;
  }

  async updateProfile(id: string, dto: UpdateUserProfileDto, performedBy?: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const [updated] = await this.drizzle.db
      .update(users)
      .set(dto)
      .where(eq(users.id, id))
      .returning();

    await this.audit.log({
      action: `Updated profile: ${user.email}`,
      entityType: 'user',
      entityId: id,
      source: 'admin',
      performedBy,
      branchId: user.branchId ?? undefined,
    });

    return updated;
  }

  async getDocuments(staffId: string) {
    return this.drizzle.db
      .select()
      .from(staffDocuments)
      .where(eq(staffDocuments.staffId, staffId))
      .orderBy(asc(staffDocuments.uploadedAt));
  }

  async addDocument(staffId: string, url: string, label?: string) {
    const [doc] = await this.drizzle.db
      .insert(staffDocuments)
      .values({ staffId, url, label: label ?? null })
      .returning();
    return doc;
  }

  async removeDocument(staffId: string, docId: number) {
    await this.drizzle.db
      .delete(staffDocuments)
      .where(and(eq(staffDocuments.id, docId), eq(staffDocuments.staffId, staffId)));
  }

  async updateBranch(id: string, branchId: number, performedBy?: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const [updated] = await this.drizzle.db
      .update(users)
      .set({ branchId })
      .where(eq(users.id, id))
      .returning();

    await this.audit.log({
      action: `Updated user branch: ${user.email} → branch ${branchId}`,
      entityType: 'user',
      entityId: id,
      source: 'admin',
      performedBy,
      branchId,
      details: { email: user.email, prevBranchId: user.branchId, newBranchId: branchId },
    });

    return updated;
  }
}

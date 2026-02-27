import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import { branches } from '../db/schema';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly drizzle: DrizzleService) {}

  async findAll() {
    return this.drizzle.db
      .select()
      .from(branches)
      .orderBy(branches.name);
  }

  async findActive() {
    return this.drizzle.db
      .select()
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(branches.name);
  }

  async findOne(id: number) {
    const [branch] = await this.drizzle.db
      .select()
      .from(branches)
      .where(eq(branches.id, id));
    if (!branch) throw new NotFoundException(`Branch ${id} not found`);
    return branch;
  }

  async create(dto: CreateBranchDto) {
    const [created] = await this.drizzle.db
      .insert(branches)
      .values({ name: dto.name })
      .returning();
    return created;
  }

  async update(id: number, dto: Partial<CreateBranchDto> & { isActive?: boolean }) {
    await this.findOne(id);
    const [updated] = await this.drizzle.db
      .update(branches)
      .set(dto)
      .where(eq(branches.id, id))
      .returning();
    return updated;
  }
}

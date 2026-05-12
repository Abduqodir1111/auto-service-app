import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// Public categories list is requested on almost every mobile-app open.
// The data changes maybe a few times a month, so we serve it from a
// short Redis cache and invalidate on every admin write.
const CATEGORIES_LIST_CACHE_KEY = 'categories:public:list';
const CATEGORIES_LIST_CACHE_TTL = 300; // 5 minutes — admin edits flush it anyway

type CategoryRow = Awaited<ReturnType<PrismaService['category']['findMany']>>[number];

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list() {
    const cached = await this.redis.getJson<CategoryRow[]>(CATEGORIES_LIST_CACHE_KEY);
    if (cached) return cached;

    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    await this.redis.setJson(CATEGORIES_LIST_CACHE_KEY, rows, CATEGORIES_LIST_CACHE_TTL);
    return rows;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [{ name: dto.name }, { slug: dto.slug }],
      },
    });

    if (existing) {
      throw new ConflictException('Category with the same name or slug already exists');
    }

    const created = await this.prisma.category.create({ data: dto });
    await this.redis.delete(CATEGORIES_LIST_CACHE_KEY);
    return created;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);

    const updated = await this.prisma.category.update({
      where: { id },
      data: dto,
    });
    await this.redis.delete(CATEGORIES_LIST_CACHE_KEY);
    return updated;
  }

  async remove(id: string) {
    await this.ensureExists(id);

    const removed = await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
    await this.redis.delete(CATEGORIES_LIST_CACHE_KEY);
    return removed;
  }

  private async ensureExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }
}

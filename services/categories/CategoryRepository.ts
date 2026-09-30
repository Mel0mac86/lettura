import type { SqlDatabase } from '@/services/database/SqlDatabase';
import type { Category, CategoryWithCount } from '@/types/models';
import { AppError } from '@/utils/errors';
import type { IdGenerator } from '@/utils/ids';

export class CategoryRepository {
  constructor(
    private readonly db: SqlDatabase,
    private readonly newId: IdGenerator,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async create(name: string, icon?: string | null): Promise<Category> {
    const trimmed = name.trim();
    if (!trimmed) throw new AppError('Il nome della categoria è obbligatorio.', 'invalid_category');
    const existing = await this.db.getFirst<Category>('SELECT * FROM categories WHERE name = ? COLLATE NOCASE', [
      trimmed,
    ]);
    if (existing) throw new AppError(`La categoria "${trimmed}" esiste già.`, 'duplicate_category');
    const category: Category = { id: this.newId(), name: trimmed, icon: icon?.trim() || null, createdAt: this.now() };
    await this.db.run('INSERT INTO categories (id, name, icon, createdAt) VALUES (?, ?, ?, ?)', [
      category.id,
      category.name,
      category.icon,
      category.createdAt,
    ]);
    return category;
  }

  list(): Promise<CategoryWithCount[]> {
    return this.db.getAll<CategoryWithCount>(
      `SELECT c.*, COUNT(bc.bookId) AS bookCount FROM categories c
       LEFT JOIN book_categories bc ON bc.categoryId = c.id
       GROUP BY c.id ORDER BY c.name COLLATE NOCASE`,
    );
  }

  async rename(id: string, name: string, icon?: string | null): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new AppError('Il nome della categoria è obbligatorio.', 'invalid_category');
    await this.db.run('UPDATE categories SET name = ?, icon = ? WHERE id = ?', [trimmed, icon?.trim() || null, id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM categories WHERE id = ?', [id]);
  }

  listForBook(bookId: string): Promise<Category[]> {
    return this.db.getAll<Category>(
      `SELECT c.* FROM categories c INNER JOIN book_categories bc ON bc.categoryId = c.id
       WHERE bc.bookId = ? ORDER BY c.name COLLATE NOCASE`,
      [bookId],
    );
  }

  async setBookCategories(bookId: string, categoryIds: readonly string[]): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM book_categories WHERE bookId = ?', [bookId]);
      for (const categoryId of new Set(categoryIds)) {
        await this.db.run('INSERT INTO book_categories (bookId, categoryId) VALUES (?, ?)', [bookId, categoryId]);
      }
    });
  }
}

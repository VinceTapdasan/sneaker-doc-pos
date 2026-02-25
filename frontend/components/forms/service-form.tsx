'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const schema = z.object({
  name: z.string().min(1, 'Service name is required'),
  type: z.enum(['primary', 'add_on']),
  price: z.string().min(1, 'Price is required').refine(
    (v) => parseFloat(v) >= 0,
    'Price must be a positive number',
  ),
});

type FormData = z.infer<typeof schema>;

interface ServiceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ServiceForm({ onSuccess, onCancel }: ServiceFormProps) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: 'primary', price: '' },
  });

  const type = watch('type');

  const createMut = useMutation({
    mutationFn: (data: FormData) => api.services.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service created');
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error('Failed to create service', { description: err.message });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => createMut.mutate(data))}
      className="bg-white border border-zinc-200 rounded-lg p-5 mb-6"
    >
      <h3 className="text-sm font-semibold text-zinc-950 mb-4">New Service</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Input
            label="Service Name"
            placeholder="e.g. Basic Clean"
            {...register('name')}
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-zinc-700">Type</Label>
          <Select value={type} onValueChange={(v) => setValue('type', v as 'primary' | 'add_on')}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Primary</SelectItem>
              <SelectItem value="add_on">Add-on</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Input
            label="Price (₱)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="font-mono"
            {...register('price')}
          />
          {errors.price && <p className="text-xs text-red-500">{errors.price.message}</p>}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button type="submit" size="sm" disabled={createMut.isPending}>
          {createMut.isPending ? <Spinner /> : 'Save Service'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

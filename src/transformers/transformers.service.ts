import { Injectable } from '@nestjs/common';
import { PortalClientService } from '../portal-client/portal-client.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PaginatedTransformersDto, TransformerDto } from './dto/transformer.dto';

interface PortalDtItem {
  code: string;
  name: string;
  feederCode: string;
  capacityKva: number;
}

interface PortalDtResponse {
  data: PortalDtItem[];
  total: number;
}

@Injectable()
export class TransformersService {
  constructor(private readonly portal: PortalClientService) {}

  async list(query: PaginationQueryDto): Promise<PaginatedTransformersDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Portal pages at 20/page — pass through directly for default limit
    const portalPage = String(Math.ceil((page * limit) / 20));

    const raw = await this.portal.get<PortalDtResponse>('/portal/dts', { page: portalPage });

    const data: TransformerDto[] = raw.data.map((dt) => ({
      code: dt.code,
      name: dt.name,
      feederCode: dt.feederCode,
      capacityKva: dt.capacityKva,
    }));

    return {
      data,
      total: raw.total,
      page,
      limit,
      totalPages: Math.ceil(raw.total / limit),
    };
  }
}

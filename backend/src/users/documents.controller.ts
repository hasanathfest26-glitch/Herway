import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateDocumentDto } from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listDocuments(user.id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  ) {
    return this.usersService.createDocument(user.id, dto, file);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.usersService.downloadDecryptedDocument(user.id, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(file.buffer);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('file'))
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  ) {
    return this.usersService.replaceDocument(user.id, id, dto, file);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.deleteDocument(user.id, id);
  }
}

"""RRDBNet compatível com os pesos oficiais RealESRGAN_x4plus (escala 4).

Arquitetura de BasicSR/Real-ESRGAN, Xintao Wang et al., BSD-3-Clause.
Referência: https://github.com/XPixelGroup/BasicSR/blob/v1.4.2/basicsr/archs/rrdbnet_arch.py
O serviço não importa BasicSR/torchvision nem baixa código durante inferência.
"""
import torch
from torch import nn
from torch.nn import functional as F


class ResidualDenseBlock(nn.Module):
    def __init__(self, num_feat=64, num_grow_ch=32):
        super().__init__()
        for i in range(1, 6):
            setattr(self, f'conv{i}', nn.Conv2d(num_feat + (i-1)*num_grow_ch,
                    num_feat if i == 5 else num_grow_ch, 3, 1, 1))
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        features = [x]
        for i in range(1, 5):
            features.append(self.lrelu(getattr(self, f'conv{i}')(torch.cat(features, 1))))
        return self.conv5(torch.cat(features, 1))*0.2 + x


class RRDB(nn.Module):
    def __init__(self):
        super().__init__()
        self.rdb1, self.rdb2, self.rdb3 = ResidualDenseBlock(), ResidualDenseBlock(), ResidualDenseBlock()

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x)))*0.2 + x


class RRDBNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv_first = nn.Conv2d(3, 64, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB() for _ in range(23)])
        self.conv_body = nn.Conv2d(64, 64, 3, 1, 1)
        self.conv_up1, self.conv_up2 = nn.Conv2d(64, 64, 3, 1, 1), nn.Conv2d(64, 64, 3, 1, 1)
        self.conv_hr, self.conv_last = nn.Conv2d(64, 64, 3, 1, 1), nn.Conv2d(64, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(x)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode='nearest')))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode='nearest')))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))

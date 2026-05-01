import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-home.page.html',
  styleUrls: ['./public-home.page.scss'],
})
export class PublicHomePage {
  goPaciente() {
    // puedes cambiar a /auth/register o /auth/login con queryParams
  }

  goDoctor() {
    // idem
  }
}
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

@Component({
  selector: "app-public-contact",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./public-contact.page.html",
  styleUrls: ["./public-info.page.scss"],
})
export class PublicContactPage {}
